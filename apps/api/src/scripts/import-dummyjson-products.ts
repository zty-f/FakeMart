import 'dotenv/config'
import { closePool, exec } from '../db/client.js'

interface DummyProduct {
  id: number
  title: string
  description: string
  category: string
  price: number
  discountPercentage?: number
  thumbnail?: string
  tags?: string[]
  brand?: string
}

interface DummyResponse {
  products: DummyProduct[]
}

const categoryMap: Record<string, string> = {
  smartphones: 'cat-digital',
  laptops: 'cat-digital',
  tablets: 'cat-digital',
  'mobile-accessories': 'cat-digital',
  furniture: 'cat-home',
  'home-decoration': 'cat-home',
  kitchen: 'cat-home',
  groceries: 'cat-food',
  beauty: 'cat-beauty',
  fragrances: 'cat-beauty',
  'skin-care': 'cat-beauty',
  'mens-shirts': 'cat-fashion',
  'mens-shoes': 'cat-fashion',
  'womens-bags': 'cat-fashion',
  'womens-dresses': 'cat-fashion',
  'womens-shoes': 'cat-fashion',
  tops: 'cat-fashion',
  sunglasses: 'cat-fashion',
  'sports-accessories': 'cat-sport'
}

function priceToCents(price: number): number {
  return Math.max(100, Math.round(price * 720))
}

async function ensureImportMerchant(): Promise<void> {
  await exec(
    `INSERT INTO merchants (id, name, type, logo_url, rating, delivery_minutes, min_order_amount, delivery_fee, tags)
     VALUES (?, ?, 'shopping', ?, 4.70, 45, 0, 0, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), logo_url = VALUES(logo_url), tags = VALUES(tags)`,
    [
      'm-online-import',
      '跨境精选馆',
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80',
      JSON.stringify(['跨境', '精选', '在线导入'])
    ]
  )
}

async function main(): Promise<void> {
  const limit = Number(process.env.DUMMYJSON_LIMIT ?? 60)
  const response = await fetch(`https://dummyjson.com/products?limit=${limit}`)
  if (!response.ok) throw new Error(`DummyJSON request failed: ${response.status}`)
  const data = (await response.json()) as DummyResponse
  await ensureImportMerchant()

  let imported = 0
  for (const item of data.products) {
    const categoryId = categoryMap[item.category] ?? 'cat-food'
    const id = `dj_${item.id}`
    const imageUrl = item.thumbnail || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80'
    const price = priceToCents(item.price)
    const compareAt = Math.round(price * (1 + Math.min(Number(item.discountPercentage ?? 12), 35) / 100))
    const tags = [item.brand, item.category, ...(item.tags ?? [])].filter(Boolean).slice(0, 5)
    await exec(
      `INSERT INTO media_assets (id, source_provider, source_asset_id, license_type, license_url, file_url, thumbnail_url, usage_scope)
       VALUES (?, 'DummyJSON', ?, 'public_test_api', 'https://dummyjson.com/docs/products', ?, ?, 'product_image')
       ON DUPLICATE KEY UPDATE file_url = VALUES(file_url), thumbnail_url = VALUES(thumbnail_url)`,
      [`asset-${id}`, String(item.id), imageUrl, imageUrl]
    )
    await exec(
      `INSERT INTO products (
        id, merchant_id, category_id, order_type, title, subtitle, description, image_url, virtual_price,
        compare_at_price, virtual_stock, virtual_sales_count, tags, status, recommendation_weight
      )
       VALUES (?, 'm-online-import', ?, 'shopping', ?, ?, ?, ?, ?, ?, 999, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), title = VALUES(title), subtitle = VALUES(subtitle),
       description = VALUES(description), image_url = VALUES(image_url), virtual_price = VALUES(virtual_price),
       compare_at_price = VALUES(compare_at_price), virtual_sales_count = VALUES(virtual_sales_count),
       tags = VALUES(tags), recommendation_weight = VALUES(recommendation_weight), updated_at = NOW()`,
      [
        id,
        categoryId,
        item.title,
        item.brand ? `${item.brand} · 跨境精选` : '跨境精选',
        item.description,
        imageUrl,
        price,
        compareAt,
        1000 + item.id * 11,
        JSON.stringify(tags),
        35 + (item.id % 45)
      ]
    )
    imported += 1
  }

  console.log(`Imported ${imported} DummyJSON products.`)
  await closePool()
}

main().catch((error) => {
  console.error(error)
  closePool().finally(() => process.exit(1))
})
