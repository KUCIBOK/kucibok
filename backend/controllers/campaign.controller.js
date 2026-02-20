const logger = require('../utils/logger');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const ContactList = require('../models/ContactList');
const EmailDraft = require('../models/EmailDraft');
const createError = require('http-errors');
const nodemailer = require('nodemailer');

// Email transporter (use your SMTP config)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// ✅ Get all campaigns
exports.getCampaigns = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;

    let query = { professionalId };
    if (status) query.status = status;

    const campaigns = await Campaign.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Campaign.countDocuments(query);

    res.status(200).json({
      campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ✅ Get single campaign
exports.getCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id)
      .populate('draftId', 'name subject')
      .populate('recipients.lists', 'name type stats')
      .populate('recipients.crmContacts', 'firstName lastName email');

    if (!campaign) {
      return next(createError.notFound('Campaign not found'));
    }

    if (campaign.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    res.status(200).json(campaign);
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ✅ Create campaign from draft
exports.createCampaign = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { name, draftId, subject, preheader, content, recipients } = req.body;

    // Get content from draft if draftId provided
    let emailContent = content;
    if (draftId) {
      const draft = await EmailDraft.findById(draftId);
      if (draft && draft.professionalId.toString() === professionalId.toString()) {
        emailContent = draft.content;
      }
    }

    // Calculate recipient count
    let totalCount = 0;
    
    if (recipients.lists && recipients.lists.length > 0) {
      const lists = await ContactList.find({ _id: { $in: recipients.lists } });
      totalCount += lists.reduce((sum, list) => sum + (list.stats?.activeContacts || 0), 0);
    }

    if (recipients.crmContacts && recipients.crmContacts.length > 0) {
      totalCount += recipients.crmContacts.length;
    }

    if (recipients.emails && recipients.emails.length > 0) {
      totalCount += recipients.emails.length;
    }

    const campaign = new Campaign({
      professionalId,
      name,
      draftId,
      subject,
      preheader,
      content: emailContent,
      recipients: {
        ...recipients,
        totalCount
      },
      status: 'draft'
    });

    await campaign.save();

    res.status(201).json(campaign);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// ✅ Update campaign
exports.updateCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return next(createError.notFound('Campaign not found'));
    }

    if (campaign.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    if (campaign.status === 'sent') {
      return next(createError.badRequest('Cannot edit sent campaign'));
    }

    Object.assign(campaign, updates);
    campaign.updatedAt = new Date();
    await campaign.save();

    res.status(200).json(campaign);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// ✅ Delete campaign
exports.deleteCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return next(createError.notFound('Campaign not found'));
    }

    if (campaign.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    if (campaign.status === 'sending') {
      return next(createError.badRequest('Cannot delete campaign while sending'));
    }

    await Campaign.deleteOne({ _id: id });

    res.status(200).json({ message: 'Campaign deleted' });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// ✅ Send test email
exports.sendTest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { testEmails } = req.body;

    if (!testEmails || testEmails.length === 0) {
      return next(createError.badRequest('Test emails required'));
    }

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return next(createError.notFound('Campaign not found'));
    }

    if (campaign.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    // Generate HTML from blocks
    const html = generateEmailHTML(campaign.content, campaign.subject, campaign.preheader);

    // Send test emails
    const transporter = createTransporter();
    
    for (const email of testEmails) {
      await transporter.sendMail({
        from: `"${req.user.name}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `[TEST] ${campaign.subject}`,
        html: html
      });
    }

    campaign.testEmails = testEmails;
    campaign.testSentAt = new Date();
    await campaign.save();

    res.status(200).json({ message: `Test emails sent to ${testEmails.length} recipients` });
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ✅ Send campaign
exports.sendCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return next(createError.notFound('Campaign not found'));
    }

    if (campaign.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    if (campaign.status === 'sent') {
      return next(createError.badRequest('Campaign already sent'));
    }

    // Schedule or send immediately
    if (scheduledAt) {
      campaign.scheduledAt = new Date(scheduledAt);
      campaign.status = 'scheduled';
      await campaign.save();
      
      res.status(200).json({ message: 'Campaign scheduled', campaign });
    } else {
      // Send immediately in background
      campaign.status = 'sending';
      await campaign.save();

      // Process sending asynchronously
      processCampaignSend(campaign._id).catch((e) => logger.error('processCampaignSend failed:', e));

      res.status(200).json({ message: 'Campaign is being sent', campaign });
    }
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ✅ Process campaign send (background job)
async function processCampaignSend(campaignId) {
  try {
    const campaign = await Campaign.findById(campaignId)
      .populate('recipients.lists')
      .populate('recipients.crmContacts');

    if (!campaign) return;

    // Collect all recipient emails
    const recipientEmails = new Set();
    const recipientMap = new Map(); // email -> contactId

    // From lists
    if (campaign.recipients.lists && campaign.recipients.lists.length > 0) {
      for (const list of campaign.recipients.lists) {
        const contacts = await Contact.find({ 
          lists: list._id,
          status: 'active'
        });
        contacts.forEach(c => {
          recipientEmails.add(c.email);
          recipientMap.set(c.email, c._id);
        });
      }
    }

    // From CRM contacts
    if (campaign.recipients.crmContacts && campaign.recipients.crmContacts.length > 0) {
      campaign.recipients.crmContacts.forEach(c => {
        if (c.email) {
          recipientEmails.add(c.email);
          recipientMap.set(c.email, c._id);
        }
      });
    }

    // From manual emails
    if (campaign.recipients.emails && campaign.recipients.emails.length > 0) {
      campaign.recipients.emails.forEach(email => {
        recipientEmails.add(email);
      });
    }

    // Generate HTML
    const html = generateEmailHTML(campaign.content, campaign.subject, campaign.preheader);

    // Send emails
    const transporter = createTransporter();
    const recipients = [];

    for (const email of recipientEmails) {
      try {
        await transporter.sendMail({
          from: `"${campaign.name}" <${process.env.SMTP_USER}>`,
          to: email,
          subject: campaign.subject,
          html: html
        });

        recipients.push({
          contactId: recipientMap.get(email),
          email,
          status: 'sent',
          sentAt: new Date()
        });

        campaign.delivery.sent++;
        campaign.delivery.delivered++;

        // Update contact stats
        if (recipientMap.has(email)) {
          await Contact.findByIdAndUpdate(recipientMap.get(email), {
            $inc: { 'stats.emailsSent': 1 },
            $set: { 'stats.lastEmailSent': new Date() }
          });
        }

      } catch (error) {
        campaign.delivery.failed++;
        campaign.delivery.errors.push({
          email,
          error: error.message,
          timestamp: new Date()
        });
        
        recipients.push({
          email,
          status: 'bounced',
          sentAt: new Date(),
          bouncedAt: new Date()
        });
      }
    }

    // Update campaign
    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.analytics.recipients = recipients;
    campaign.recipients.totalCount = recipientEmails.size;

    await campaign.save();

    logger.info(`Campaign ${campaignId} sent to ${campaign.delivery.delivered} recipients`);
  } catch (error) {
    logger.error('Error sending campaign:', error);
    
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'draft',
      $push: {
        'delivery.errors': {
          email: 'system',
          error: error.message,
          timestamp: new Date()
        }
      }
    });
  }
}

// ✅ Track email open
exports.trackOpen = async (req, res, next) => {
  try {
    const { campaignId, email } = req.query;

    const campaign = await Campaign.findById(campaignId);
    if (campaign) {
      const recipient = campaign.analytics.recipients.find(r => r.email === email);
      
      if (recipient) {
        if (!recipient.openedAt || recipient.openedAt.length === 0) {
          campaign.analytics.uniqueOpens++;
        }
        
        if (!recipient.openedAt) recipient.openedAt = [];
        recipient.openedAt.push(new Date());
        recipient.status = 'opened';
        campaign.analytics.opens++;

        await campaign.save();

        // Update contact stats
        if (recipient.contactId) {
          await Contact.findByIdAndUpdate(recipient.contactId, {
            $inc: { 'stats.emailsOpened': 1 },
            $set: { 'stats.lastEmailOpened': new Date() }
          });
        }
      }
    }

    // Return 1x1 transparent pixel
    res.set('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch (error) {
    res.status(200).end();
  }
};

// ✅ Track click
exports.trackClick = async (req, res, next) => {
  try {
    const { campaignId, email, url } = req.query;

    const campaign = await Campaign.findById(campaignId);
    if (campaign) {
      const recipient = campaign.analytics.recipients.find(r => r.email === email);
      
      if (recipient) {
        if (!recipient.clickedAt || recipient.clickedAt.length === 0) {
          campaign.analytics.uniqueClicks++;
        }
        
        if (!recipient.clickedAt) recipient.clickedAt = [];
        if (!recipient.clickedLinks) recipient.clickedLinks = [];
        
        recipient.clickedAt.push(new Date());
        recipient.clickedLinks.push(url);
        recipient.status = 'clicked';
        campaign.analytics.clicks++;

        await campaign.save();

        // Update contact stats
        if (recipient.contactId) {
          await Contact.findByIdAndUpdate(recipient.contactId, {
            $inc: { 'stats.emailsClicked': 1 },
            $set: { 'stats.lastEmailClicked': new Date() }
          });
        }
      }
    }

    // Redirect to actual URL
    res.redirect(url);
  } catch (error) {
    res.status(404).send('Link not found');
  }
};

// ✅ Get campaign analytics
exports.getCampaignAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return next(createError.notFound('Campaign not found'));
    }

    if (campaign.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    // Calculate rates
    const sent = campaign.delivery.sent || 0;
    const openRate = sent > 0 ? (campaign.analytics.uniqueOpens / sent * 100).toFixed(2) : 0;
    const clickRate = sent > 0 ? (campaign.analytics.uniqueClicks / sent * 100).toFixed(2) : 0;
    const clickToOpenRate = campaign.analytics.uniqueOpens > 0 
      ? (campaign.analytics.uniqueClicks / campaign.analytics.uniqueOpens * 100).toFixed(2) 
      : 0;

    res.status(200).json({
      campaign: {
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        sentAt: campaign.sentAt
      },
      delivery: campaign.delivery,
      engagement: {
        opens: campaign.analytics.opens,
        uniqueOpens: campaign.analytics.uniqueOpens,
        clicks: campaign.analytics.clicks,
        uniqueClicks: campaign.analytics.uniqueClicks,
        unsubscribes: campaign.analytics.unsubscribes,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        clickToOpenRate: parseFloat(clickToOpenRate)
      },
      recipients: campaign.analytics.recipients
    });
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// Helper: Generate HTML from blocks
function generateEmailHTML(content, subject, preheader) {
  if (!content || !content.blocks) {
    return '<p>Empty email</p>';
  }

  const theme = content.theme || {};
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { margin: 0; padding: 0; font-family: ${theme.fontFamily || 'Arial, sans-serif'}; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: ${theme.backgroundColor || '#ffffff'}; }
        .content { padding: 20px; color: ${theme.textColor || '#333333'}; }
        .hero { text-align: center; padding: 40px 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: ${theme.primaryColor || '#4F46E5'}; color: #ffffff; text-decoration: none; border-radius: 6px; }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
      <div class="container">
        <div class="content">
  `;

  content.blocks.forEach(block => {
    switch (block.type) {
      case 'hero':
        html += `
          <div class="hero">
            <h1>${block.content.title || ''}</h1>
            <p>${block.content.subtitle || ''}</p>
            ${block.content.ctaText ? `<a href="${block.content.ctaUrl || '#'}" class="button">${block.content.ctaText}</a>` : ''}
          </div>
        `;
        break;
      
      case 'text':
        html += `<div>${block.content.html || ''}</div>`;
        break;
      
      case 'image':
        html += `
          <div style="text-align: center; margin: 20px 0;">
            ${block.content.url ? `<img src="${block.content.url}" alt="${block.content.alt || ''}" />` : ''}
            ${block.content.caption ? `<p style="font-size: 14px; color: #666;">${block.content.caption}</p>` : ''}
          </div>
        `;
        break;
      
      case 'button':
        html += `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${block.content.url || '#'}" class="button">${block.content.text || 'Click here'}</a>
          </div>
        `;
        break;
      
      case 'divider':
        html += `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />`;
        break;
      
      case 'spacer':
        html += `<div style="height: ${block.content.height || 40}px;"></div>`;
        break;
    }
  });

  html += `
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}
