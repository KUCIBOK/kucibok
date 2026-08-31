#!/bin/bash

# Test Admin Notifications in Production
# Usage: bash test-prod-notifications.sh

API="https://kucibok.com/api"
API_KEY="${VITE_API_KEY:-}"

echo "🧪 Testing Admin Notifications in Production"
echo "API: $API"
echo "─────────────────────────────────────────────────────────"
echo ""

# Test 1: Sourcing Inquiry (Public)
echo "1️⃣  Testing Sourcing Inquiry..."
curl -X POST "$API/sourcing/inquiry" \
  -H "Content-Type: application/json" \
  -H "kcb-api-key: $API_KEY" \
  -d '{
    "company_name": "Test Gallery Ltd",
    "inquiry_type": "Gallery Partnership",
    "contact_email": "contact@testgallery.com",
    "contact_name": "Jane Smith",
    "message": "We are interested in establishing a partnership with Kucibok to represent African artists in Europe. We have a network of 50+ collectors."
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 2: Delivery Request (Requires Auth - will fail, but shows the format)
echo "2️⃣  Testing Delivery Request (requires auth)..."
curl -X POST "$API/delivery/request" \
  -H "Content-Type: application/json" \
  -H "kcb-api-key: $API_KEY" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "artwork_ids": ["artwork-001", "artwork-002"],
    "destination_country": "France",
    "delivery_type": "express",
    "special_instructions": "Handle with extreme care - fragile items"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 3: Payment Webhook (Public)
echo "3️⃣  Testing Payment Webhook..."
curl -X POST "$API/payments/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TXN-PROD-'$(date +%s)'",
    "status": "success",
    "amount": 75000,
    "currency": "XOF",
    "user_id": "test-user-prod",
    "type": "purchase"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 4: Certificate (Requires Auth - will fail, but shows the format)
echo "4️⃣  Testing Certificate Generation (requires auth)..."
curl -X POST "$API/certificates/generate" \
  -H "Content-Type: application/json" \
  -H "kcb-api-key: $API_KEY" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "artwork_id": "artwork-001",
    "artist_name": "Amadou Tall",
    "artwork_title": "Senegalese Landscape - Sunset",
    "dimensions": "120 x 150 cm",
    "medium": "Acrylic on Canvas",
    "year": 2024
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 5: Comment (Requires Auth - will fail)
echo "5️⃣  Testing Comment/Review (requires auth)..."
curl -X POST "$API/comments/artwork/artwork-001" \
  -H "Content-Type: application/json" \
  -H "kcb-api-key: $API_KEY" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "text": "This is an absolutely stunning piece of contemporary African art. The use of color and the compositional balance are remarkable. The artist has managed to capture the essence of Senegalese culture in a modern, engaging way.",
    "rating": 5
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test 6: Error Report (Public)
echo "6️⃣  Testing Error Report..."
curl -X POST "$API/errors/report" \
  -H "Content-Type: application/json" \
  -d '{
    "error_type": "ReferenceError",
    "error_message": "Cannot access property of undefined",
    "page_url": "https://kucibok.com/dashboard/artworks",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "additional_context": "Error occurred in artwork gallery component when loading user collection"
  }' \
  -w "\nStatus: %{http_code}\n\n"

echo "─────────────────────────────────────────────────────────"
echo ""
echo "✅ Tests completed!"
echo ""
echo "📧 Check kucibok221@gmail.com for incoming notifications"
echo "🔍 Check Vercel Logs for [Email] or [AdminNotification] messages"
echo ""
