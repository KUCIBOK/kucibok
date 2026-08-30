#!/usr/bin/env node
/**
 * Test Admin Notifications with CORRECT column names
 * Usage: node test-prod-fixed.js
 */

const API_BASE = 'https://kucibok.com/api'

console.log('🧪 Testing Admin Notifications (Fixed Columns)\n')
console.log('API Base:', API_BASE)
console.log('─'.repeat(70) + '\n')

const tests = [
  {
    name: '1️⃣  Sourcing Inquiry (Fixed Columns)',
    method: 'POST',
    endpoint: '/sourcing/inquiry',
    body: {
      organization: 'African Art Gallery Paris',
      purpose: 'Gallery Partnership & Artist Representation',
      budget: 500000, // XOF
      message: 'We are a leading gallery in Paris with 200+ collectors. We want to represent African artists through Kucibok platform.',
    },
  },
  {
    name: '2️⃣  Error Report (No Auth Required)',
    method: 'POST',
    endpoint: '/errors/report',
    body: {
      error_type: 'NetworkError',
      error_message: 'Failed to load artwork gallery',
      page_url: 'https://kucibok.com/dashboard',
      user_agent: 'Mozilla/5.0 Windows NT 10.0 Win64 x64',
      additional_context: 'Timeout after 10 seconds on gallery load',
    },
  },
]

async function runTest(test) {
  try {
    const url = `${API_BASE}${test.endpoint}`
    const headers = {
      'Content-Type': 'application/json',
    }

    console.log(`\n📝 ${test.name}`)
    console.log(`   POST ${test.endpoint}`)
    console.log(`   Columns: ${Object.keys(test.body).join(', ')}`)

    const response = await fetch(url, {
      method: test.method,
      headers,
      body: JSON.stringify(test.body),
    })

    const data = await response.json()

    console.log(`   Status: ${response.status}`)

    if (response.ok) {
      console.log(`   ✅ Success!`)
      console.log(`   Message: ${data.message}`)
      console.log(`   💌 Notification sent to admin...`)
    } else {
      console.log(`   ❌ Error: ${data.error}`)
      if (data.errors) {
        console.log(`   Details: ${JSON.stringify(data.errors)}`)
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
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  // Summary
  console.log('\n' + '─'.repeat(70))
  console.log('\n📊 TEST SUMMARY\n')

  let passed = 0
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.name}`)
      passed++
    } else {
      console.log(`❌ ${result.name}`)
    }
  })

  console.log(`\n📈 Results: ${passed}/${results.length} passed\n`)

  if (passed > 0) {
    console.log('✅ Notifications sent successfully!')
    console.log('\n📧 Check kucibok221@gmail.com for emails in 2-3 minutes')
    console.log('🔍 Check Vercel Logs for [Email] or [AdminNotification] messages\n')
  }

  console.log('─'.repeat(70) + '\n')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
