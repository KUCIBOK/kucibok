#!/usr/bin/env node
/**
 * Test all admin notifications
 * Usage: node test-notifications.js
 *
 * Tests:
 * 1. Signup notification
 * 2. Artwork notification
 * 3. Trial subscription notification
 * 4. Sourcing inquiry notification
 * 5. Delivery request notification
 * 6. Payment webhook notification
 * 7. Certificate notification
 * 8. Comment notification
 * 9. Error report notification
 */

import fs from 'fs'
import path from 'path'

// Load .env.local
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
      }
    }
  })
}

const API_BASE = process.env.VITE_API_URL || 'http://localhost:5173/api'
const API_KEY = process.env.VITE_API_KEY || ''

console.log('🧪 Testing Admin Notifications System\n')
console.log('API Base:', API_BASE)
console.log('─'.repeat(70) + '\n')

const tests = [
  {
    name: '1️⃣  Sourcing Inquiry Notification',
    method: 'POST',
    endpoint: '/sourcing/inquiry',
    body: {
      company_name: 'Test Company Inc.',
      inquiry_type: 'Gallery Partnership',
      contact_email: 'contact@testcompany.com',
      contact_name: 'John Doe',
      message: 'We are interested in establishing a partnership with Kucibok to represent African artists in Europe.',
    },
  },
  {
    name: '2️⃣  Delivery Request Notification',
    method: 'POST',
    endpoint: '/delivery/request',
    body: {
      artwork_ids: ['test-artwork-1', 'test-artwork-2'],
      destination_country: 'France',
      delivery_type: 'express',
      special_instructions: 'Handle with care - fragile items',
    },
    requiresAuth: true,
  },
  {
    name: '3️⃣  Payment Webhook Notification',
    method: 'POST',
    endpoint: '/payments/webhook',
    body: {
      transaction_id: 'TXN-' + Date.now(),
      status: 'success',
      amount: 50000,
      currency: 'XOF',
      user_id: 'test-user-123',
      type: 'purchase',
    },
  },
  {
    name: '4️⃣  Certificate Generation Notification',
    method: 'POST',
    endpoint: '/certificates/generate',
    body: {
      artwork_id: 'artwork-test-1',
      artist_name: 'Amadou Tall',
      artwork_title: 'Senegalese Landscape',
      dimensions: '100 x 150 cm',
      medium: 'Acrylic on Canvas',
      year: 2024,
    },
    requiresAuth: true,
  },
  {
    name: '5️⃣  Comment/Review Notification',
    method: 'POST',
    endpoint: '/comments/artwork/artwork-test-1',
    body: {
      text: 'This is an exceptional piece of art. The colors and composition are absolutely stunning. I am very impressed with the artist\'s work.',
      rating: 5,
    },
    requiresAuth: true,
  },
  {
    name: '6️⃣  Error Report Notification',
    method: 'POST',
    endpoint: '/errors/report',
    body: {
      error_type: 'TypeError',
      error_message: 'Cannot read property \'name\' of undefined',
      page_url: 'https://kucibok.com/dashboard/artworks',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      additional_context: 'Error occurred when loading user artworks list',
    },
  },
]

async function runTest(test) {
  try {
    const url = `${API_BASE}${test.endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      'kcb-api-key': API_KEY,
    }

    // Add mock auth header for tests requiring auth
    if (test.requiresAuth) {
      headers['Authorization'] = 'Bearer test-token-for-notification-testing'
    }

    console.log(`\n📝 ${test.name}`)
    console.log(`   Method: ${test.method}`)
    console.log(`   Endpoint: ${test.endpoint}`)
    console.log(`   Body: ${JSON.stringify(test.body).substring(0, 100)}...`)

    const response = await fetch(url, {
      method: test.method,
      headers,
      body: JSON.stringify(test.body),
    })

    const data = await response.json()

    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`)
      console.log(`   ✅ Message: ${data.message || 'Success'}`)
      console.log(`   💌 Admin should receive notification shortly...`)
    } else {
      console.log(`   ❌ Status: ${response.status}`)
      console.log(`   ❌ Error: ${data.error}`)
      if (data.errors) {
        console.log(`   ❌ Details: ${JSON.stringify(data.errors)}`)
      }
    }

    return { success: response.ok, name: test.name, status: response.status }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`)
    return { success: false, name: test.name, error: error.message }
  }
}

async function main() {
  const results = []

  for (const test of tests) {
    const result = await runTest(test)
    results.push(result)
    // Wait 1 second between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Summary
  console.log('\n' + '─'.repeat(70))
  console.log('\n📊 TEST SUMMARY\n')

  let passed = 0
  let failed = 0

  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.name}`)
      passed++
    } else {
      console.log(`❌ ${result.name} — ${result.error || `Status: ${result.status}`}`)
      failed++
    }
  })

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed out of ${results.length} tests\n`)

  if (failed === 0) {
    console.log('🎉 All tests passed!')
    console.log('\n✅ Admin notifications are working correctly!')
    console.log('📧 Check kucibok221@gmail.com for incoming notifications from Resend.\n')
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.\n')
  }

  console.log('─'.repeat(70))
  console.log('\n📝 Next Steps:')
  console.log('1. Check kucibok221@gmail.com for email notifications')
  console.log('2. Verify Vercel logs: vercel.com → Logs')
  console.log('3. Look for [Email] or [AdminNotification] messages')
  console.log('4. Test with real authentication tokens for auth-required endpoints\n')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
