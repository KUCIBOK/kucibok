#!/usr/bin/env node
/**
 * Test Admin Notifications in Production
 * Usage: node test-prod-curl.js
 */

const API_BASE = 'https://kucibok.com/api'
const API_KEY = process.env.VITE_API_KEY || ''

console.log('🧪 Testing Admin Notifications in Production\n')
console.log('API Base:', API_BASE)
console.log('─'.repeat(70) + '\n')

const tests = [
  {
    name: '1️⃣  Sourcing Inquiry (Public)',
    method: 'POST',
    endpoint: '/sourcing/inquiry',
    body: {
      company_name: 'African Art Collective Ltd',
      inquiry_type: 'Gallery Partnership',
      contact_email: 'hello@africanartcollective.com',
      contact_name: 'Marie Dubois',
      message: 'We are a leading gallery in Paris with connections to 200+ collectors across Europe. We are very interested in becoming an official partner of Kucibok to represent African artists.',
    },
  },
  {
    name: '2️⃣  Payment Webhook (Public)',
    method: 'POST',
    endpoint: '/payments/webhook',
    body: {
      transaction_id: 'TXN-PROD-' + Date.now(),
      status: 'success',
      amount: 125000,
      currency: 'XOF',
      user_id: 'test-buyer-prod',
      type: 'purchase',
    },
  },
  {
    name: '3️⃣  Error Report (Public)',
    method: 'POST',
    endpoint: '/errors/report',
    body: {
      error_type: 'NetworkError',
      error_message: 'Failed to fetch user profile data from server',
      page_url: 'https://kucibok.com/dashboard/artworks',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      additional_context: 'Network timeout when loading artworks. Retry button appeared after 5 seconds.',
    },
  },
]

async function runTest(test) {
  try {
    const url = `${API_BASE}${test.endpoint}`
    const headers = {
      'Content-Type': 'application/json',
    }

    if (API_KEY) {
      headers['kcb-api-key'] = API_KEY
    }

    console.log(`\n📝 ${test.name}`)
    console.log(`   POST ${test.endpoint}`)
    console.log(`   Body: ${JSON.stringify(test.body).substring(0, 80)}...`)

    const response = await fetch(url, {
      method: test.method,
      headers,
      body: JSON.stringify(test.body),
    })

    const data = await response.json()

    console.log(`   Status: ${response.status}`)

    if (response.ok) {
      console.log(`   ✅ Success`)
      console.log(`   Message: ${data.message || data.success}`)
      console.log(`   💌 Admin notification being sent to kucibok221@gmail.com...`)
    } else {
      console.log(`   ❌ Error: ${data.error}`)
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
    // Wait 2 seconds between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000))
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
    console.log('\n✅ Admin notifications are being sent!\n')
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.\n')
  }

  console.log('─'.repeat(70))
  console.log('\n📝 Next Steps:')
  console.log('1. ✅ Check kucibok221@gmail.com for email notifications (2-3 minutes)')
  console.log('2. 🔍 Verify Vercel Logs: https://vercel.com/kucibok221-8539s-projects/kucibok/logs')
  console.log('3. 📋 Look for [Email] or [AdminNotification] messages in logs')
  console.log('4. 💬 Verify notifications contain correct event details\n')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
