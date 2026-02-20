const logger = require('../utils/logger');
const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const ContactList = require('../models/ContactList');
const createError = require('http-errors');

// Try to import CRM model if it exists
let CRMContact;
try {
  CRMContact = require('../models/CRMContact');
} catch (e) {
  logger.info('CRMContact model not found, CRM sync disabled');
}

// ========== CONTACTS ==========

// Get all contacts
exports.getContacts = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { status, type, search, tag, listId, page = 1, limit = 50 } = req.query;

    let query = { professionalId };

    if (status) query.status = status;
    if (type) query.type = type;
    if (tag) query.tags = tag;
    if (listId) query.lists = listId;
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(query)
      .populate('lists', 'name type')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Contact.countDocuments(query);

    res.status(200).json({
      contacts,
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

// Get single contact
exports.getContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findById(id).populate('lists', 'name type');

    if (!contact) {
      return next(createError.notFound('Contact not found'));
    }

    if (contact.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    res.status(200).json(contact);
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// Create contact
exports.createContact = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { firstName, lastName, email, phone, company, tags, type, customFields, notes, lists, consent } = req.body;

    // Check for duplicate email
    const existing = await Contact.findOne({ professionalId, email });
    if (existing) {
      return next(createError.badRequest('Contact with this email already exists'));
    }

    const contact = new Contact({
      professionalId,
      firstName,
      lastName,
      email,
      phone,
      company,
      tags: tags || [],
      type: type || 'collector',
      customFields,
      notes,
      lists: lists || [],
      source: 'manual',
      consent: consent || { marketing: true, grantedAt: new Date(), source: 'manual' }
    });

    await contact.save();

    // Update list statistics
    if (lists && lists.length > 0) {
      await ContactList.updateMany(
        { _id: { $in: lists } },
        { $inc: { 'stats.totalContacts': 1, 'stats.activeContacts': 1 } }
      );
    }

    res.status(201).json(contact);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Update contact
exports.updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const contact = await Contact.findById(id);

    if (!contact) {
      return next(createError.notFound('Contact not found'));
    }

    if (contact.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    // Handle list changes
    if (updates.lists) {
      const oldLists = contact.lists;
      const newLists = updates.lists;

      const removedLists = oldLists.filter(l => !newLists.includes(l.toString()));
      const addedLists = newLists.filter(l => !oldLists.map(ol => ol.toString()).includes(l));

      if (removedLists.length > 0) {
        await ContactList.updateMany(
          { _id: { $in: removedLists } },
          { $inc: { 'stats.totalContacts': -1, 'stats.activeContacts': -1 } }
        );
      }

      if (addedLists.length > 0) {
        await ContactList.updateMany(
          { _id: { $in: addedLists } },
          { $inc: { 'stats.totalContacts': 1, 'stats.activeContacts': 1 } }
        );
      }
    }

    Object.assign(contact, updates);
    contact.updatedAt = new Date();
    await contact.save();

    res.status(200).json(contact);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Delete contact
exports.deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findById(id);

    if (!contact) {
      return next(createError.notFound('Contact not found'));
    }

    if (contact.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    // Update list statistics
    if (contact.lists && contact.lists.length > 0) {
      await ContactList.updateMany(
        { _id: { $in: contact.lists } },
        { $inc: { 'stats.totalContacts': -1, 'stats.activeContacts': -1 } }
      );
    }

    await Contact.deleteOne({ _id: id });

    res.status(200).json({ message: 'Contact deleted' });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Bulk import contacts
exports.importContacts = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { contacts, listId } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return next(createError.badRequest('Contacts array required'));
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const contactData of contacts) {
      try {
        const existing = await Contact.findOne({ 
          professionalId, 
          email: contactData.email 
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        const contact = new Contact({
          professionalId,
          ...contactData,
          lists: listId ? [listId] : [],
          source: 'import',
          consent: { marketing: true, grantedAt: new Date(), source: 'import' }
        });

        await contact.save();
        results.imported++;
      } catch (err) {
        results.errors.push({ email: contactData.email, error: err.message });
      }
    }

    // Update list stats
    if (listId && results.imported > 0) {
      await ContactList.findByIdAndUpdate(listId, {
        $inc: { 
          'stats.totalContacts': results.imported,
          'stats.activeContacts': results.imported 
        }
      });
    }

    res.status(200).json(results);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Unsubscribe contact
exports.unsubscribeContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const contact = await Contact.findById(id);

    if (!contact) {
      return next(createError.notFound('Contact not found'));
    }

    contact.status = 'unsubscribed';
    contact.unsubscribedAt = new Date();
    contact.unsubscribeReason = reason || 'User request';
    await contact.save();

    // Update list stats
    if (contact.lists && contact.lists.length > 0) {
      await ContactList.updateMany(
        { _id: { $in: contact.lists } },
        { 
          $inc: { 
            'stats.activeContacts': -1,
            'stats.unsubscribed': 1
          }
        }
      );
    }

    res.status(200).json({ message: 'Contact unsubscribed' });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// ========== LISTS ==========

// Get all lists
exports.getLists = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { type, archived } = req.query;

    let query = { professionalId };
    if (type) query.type = type;
    query.isArchived = archived === 'true';

    const lists = await ContactList.find(query)
      .sort({ createdAt: -1 });

    res.status(200).json(lists);
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// Get single list
exports.getList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const list = await ContactList.findById(id);

    if (!list) {
      return next(createError.notFound('List not found'));
    }

    if (list.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    // Get contacts in this list
    const contacts = await Contact.find({ lists: id })
      .select('firstName lastName email status type stats')
      .limit(100);

    res.status(200).json({ list, contacts });
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// Create list
exports.createList = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { name, description, type, criteria, event, settings } = req.body;

    const list = new ContactList({
      professionalId,
      name,
      description,
      type: type || 'static',
      criteria,
      event,
      settings
    });

    await list.save();

    res.status(201).json(list);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Update list
exports.updateList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const list = await ContactList.findById(id);

    if (!list) {
      return next(createError.notFound('List not found'));
    }

    if (list.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    Object.assign(list, updates);
    list.updatedAt = new Date();
    await list.save();

    res.status(200).json(list);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Delete list
exports.deleteList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const list = await ContactList.findById(id);

    if (!list) {
      return next(createError.notFound('List not found'));
    }

    if (list.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    // Remove list reference from contacts
    await Contact.updateMany(
      { lists: id },
      { $pull: { lists: id } }
    );

    await ContactList.deleteOne({ _id: id });

    res.status(200).json({ message: 'List deleted' });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Update RSVP status
exports.updateRSVP = async (req, res, next) => {
  try {
    const { id } = req.params; // listId
    const { contactId, status, guestsCount, notes } = req.body;

    const list = await ContactList.findById(id);

    if (!list) {
      return next(createError.notFound('List not found'));
    }

    if (list.professionalId.toString() !== req.user._id.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    if (list.type !== 'event') {
      return next(createError.badRequest('RSVP only available for event lists'));
    }

    // Find or create RSVP
    const rsvpIndex = list.rsvps.findIndex(r => r.contactId.toString() === contactId);

    if (rsvpIndex >= 0) {
      list.rsvps[rsvpIndex].status = status;
      list.rsvps[rsvpIndex].respondedAt = new Date();
      list.rsvps[rsvpIndex].guestsCount = guestsCount || 1;
      list.rsvps[rsvpIndex].notes = notes;
    } else {
      list.rsvps.push({
        contactId,
        status,
        respondedAt: new Date(),
        guestsCount: guestsCount || 1,
        notes
      });
    }

    await list.save();

    res.status(200).json(list);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Get contact statistics
exports.getContactStats = async (req, res, next) => {
  try {
    const professionalId = req.user._id;

    const total = await Contact.countDocuments({ professionalId });
    const active = await Contact.countDocuments({ professionalId, status: 'active' });
    const unsubscribed = await Contact.countDocuments({ professionalId, status: 'unsubscribed' });
    const bounced = await Contact.countDocuments({ professionalId, status: 'bounced' });

    const byType = await Contact.aggregate([
      { $match: { professionalId: mongoose.Types.ObjectId(professionalId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const recentContacts = await Contact.find({ professionalId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email type createdAt');

    res.status(200).json({
      total,
      active,
      unsubscribed,
      bounced,
      byType,
      recentContacts
    });
  } catch (error) {
    next(createError.internal(error.message));
  }
};

// ========== CRM SYNC ==========

// Sync CRM contact to marketing contacts
exports.syncFromCRM = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { crmContactId, listId, tags } = req.body;

    if (!CRMContact) {
      return next(createError.badRequest('CRM module not available'));
    }

    // Get CRM contact
    const crmContact = await CRMContact.findById(crmContactId);
    
    if (!crmContact) {
      return next(createError.notFound('CRM contact not found'));
    }

    if (crmContact.professionalId.toString() !== professionalId.toString()) {
      return next(createError.forbidden('Access denied'));
    }

    // Check if already exists
    let contact = await Contact.findOne({ 
      professionalId, 
      email: crmContact.email 
    });

    if (contact) {
      // Update existing
      contact.firstName = crmContact.firstName || contact.firstName;
      contact.lastName = crmContact.lastName || contact.lastName;
      contact.phone = crmContact.phone || contact.phone;
      contact.company = crmContact.company || contact.company;
      
      if (tags && tags.length > 0) {
        contact.tags = [...new Set([...contact.tags, ...tags])];
      }
      
      if (listId && !contact.lists.includes(listId)) {
        contact.lists.push(listId);
      }
      
      contact.customFields = {
        ...contact.customFields,
        crmContactId: crmContact._id,
        syncedAt: new Date()
      };
      
      await contact.save();
      
      return res.status(200).json({ 
        message: 'Contact updated from CRM', 
        contact,
        isNew: false 
      });
    }

    // Create new contact
    contact = new Contact({
      professionalId,
      firstName: crmContact.firstName,
      lastName: crmContact.lastName,
      email: crmContact.email,
      phone: crmContact.phone,
      company: crmContact.company,
      type: 'collector', // Default type
      tags: tags || ['crm'],
      lists: listId ? [listId] : [],
      source: 'crm',
      consent: {
        marketing: true,
        grantedAt: new Date(),
        source: 'crm'
      },
      customFields: {
        crmContactId: crmContact._id,
        syncedAt: new Date()
      }
    });

    await contact.save();

    // Update list stats
    if (listId) {
      await ContactList.findByIdAndUpdate(listId, {
        $inc: { 
          'stats.totalContacts': 1,
          'stats.activeContacts': 1 
        }
      });
    }

    res.status(201).json({ 
      message: 'Contact created from CRM', 
      contact,
      isNew: true 
    });
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Bulk sync from CRM
exports.bulkSyncFromCRM = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { crmContactIds, listId, tags } = req.body;

    if (!CRMContact) {
      return next(createError.badRequest('CRM module not available'));
    }

    if (!crmContactIds || crmContactIds.length === 0) {
      return next(createError.badRequest('CRM contact IDs required'));
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const crmContactId of crmContactIds) {
      try {
        const crmContact = await CRMContact.findById(crmContactId);
        
        if (!crmContact || crmContact.professionalId.toString() !== professionalId.toString()) {
          results.skipped++;
          continue;
        }

        let contact = await Contact.findOne({ 
          professionalId, 
          email: crmContact.email 
        });

        if (contact) {
          // Update
          contact.firstName = crmContact.firstName || contact.firstName;
          contact.lastName = crmContact.lastName || contact.lastName;
          contact.phone = crmContact.phone || contact.phone;
          contact.company = crmContact.company || contact.company;
          
          if (tags && tags.length > 0) {
            contact.tags = [...new Set([...contact.tags, ...tags])];
          }
          
          if (listId && !contact.lists.includes(listId)) {
            contact.lists.push(listId);
            await ContactList.findByIdAndUpdate(listId, {
              $inc: { 'stats.totalContacts': 1, 'stats.activeContacts': 1 }
            });
          }
          
          contact.customFields = {
            ...contact.customFields,
            crmContactId: crmContact._id,
            syncedAt: new Date()
          };
          
          await contact.save();
          results.updated++;
        } else {
          // Create
          contact = new Contact({
            professionalId,
            firstName: crmContact.firstName,
            lastName: crmContact.lastName,
            email: crmContact.email,
            phone: crmContact.phone,
            company: crmContact.company,
            type: 'collector',
            tags: tags || ['crm'],
            lists: listId ? [listId] : [],
            source: 'crm',
            consent: {
              marketing: true,
              grantedAt: new Date(),
              source: 'crm'
            },
            customFields: {
              crmContactId: crmContact._id,
              syncedAt: new Date()
            }
          });

          await contact.save();
          
          if (listId) {
            await ContactList.findByIdAndUpdate(listId, {
              $inc: { 'stats.totalContacts': 1, 'stats.activeContacts': 1 }
            });
          }
          
          results.created++;
        }
      } catch (err) {
        results.errors.push({ crmContactId, error: err.message });
      }
    }

    res.status(200).json(results);
  } catch (error) {
    next(createError.badRequest(error.message));
  }
};

// Check if CRM contact is synced
exports.checkCRMSync = async (req, res, next) => {
  try {
    const professionalId = req.user._id;
    const { crmContactId } = req.params;

    const contact = await Contact.findOne({
      professionalId,
      'customFields.crmContactId': crmContactId
    });

    res.status(200).json({
      synced: !!contact,
      contact: contact || null
    });
  } catch (error) {
    next(createError.internal(error.message));
  }
};
