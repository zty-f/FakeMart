import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { exec, row, rows } from './client.js'
import { categories, merchants, products } from './seed-data.js'

export async function seedDatabase(): Promise<void> {
  await seedUsers()
  await seedCategories()
  await seedMerchants()
  await seedProducts()
  await seedCoupons()
  await seedAdmin()
}

async function seedUsers(): Promise<void> {
  const existing = await row('SELECT id FROM users WHERE id = ?', ['demo-user'])
  if (!existing) {
    await exec(
      `INSERT INTO users (id, username, display_name, avatar_url, default_address_label, status, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      ['demo-user', 'demo', '假装购体验用户', null, '奥特曼 星期八 138****7788 光之国银河路 7 号 宇宙便利店楼上 302']
    )
    const passwordHash = await bcrypt.hash('demo123456', 10)
    await exec(
      `INSERT INTO auth_accounts (id, user_id, provider, provider_user_id, password_hash, bound_at, last_login_at, status)
       VALUES (?, ?, 'username_password', ?, ?, NOW(), NOW(), 'active')`,
      ['auth-demo', 'demo-user', 'demo', passwordHash]
    )
  }
}

async function seedCategories(): Promise<void> {
  for (const category of categories) {
    await exec(
      `INSERT INTO categories (id, name, slug, icon, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), description = VALUES(description), sort_order = VALUES(sort_order)`,
      [category.id, category.name, category.slug, category.icon, category.description, category.sortOrder]
    )
  }
}

async function seedMerchants(): Promise<void> {
  for (const merchant of merchants) {
    await exec(
      `INSERT INTO merchants (id, name, type, logo_url, rating, delivery_minutes, min_order_amount, delivery_fee, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), logo_url = VALUES(logo_url), rating = VALUES(rating),
       delivery_minutes = VALUES(delivery_minutes), min_order_amount = VALUES(min_order_amount), delivery_fee = VALUES(delivery_fee), tags = VALUES(tags)`,
      [
        merchant.id,
        merchant.name,
        merchant.type,
        merchant.logoUrl,
        merchant.rating,
        merchant.deliveryMinutes,
        merchant.minOrderAmount,
        merchant.deliveryFee,
        JSON.stringify(merchant.tags)
      ]
    )
  }
}

async function seedProducts(): Promise<void> {
  for (const product of products) {
    await exec(
      `INSERT INTO media_assets (id, source_provider, source_asset_id, license_type, license_url, file_url, thumbnail_url, usage_scope)
       VALUES (?, 'UnsplashDevelopmentSet', ?, 'development_placeholder', 'https://unsplash.com/license', ?, ?, 'product_image')
       ON DUPLICATE KEY UPDATE file_url = VALUES(file_url), thumbnail_url = VALUES(thumbnail_url)`,
      [`asset-${product.id}`, product.id, product.imageUrl, product.imageUrl]
    )
    await exec(
      `INSERT INTO products (
        id, merchant_id, category_id, order_type, title, subtitle, description, image_url, virtual_price,
        compare_at_price, virtual_stock, virtual_sales_count, tags, status, recommendation_weight
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE merchant_id = VALUES(merchant_id), category_id = VALUES(category_id), order_type = VALUES(order_type),
       title = VALUES(title), subtitle = VALUES(subtitle), description = VALUES(description), image_url = VALUES(image_url),
       virtual_price = VALUES(virtual_price), compare_at_price = VALUES(compare_at_price), virtual_stock = VALUES(virtual_stock),
       virtual_sales_count = VALUES(virtual_sales_count), tags = VALUES(tags), status = VALUES(status),
       recommendation_weight = VALUES(recommendation_weight)`,
      [
        product.id,
        product.merchantId,
        product.categoryId,
        product.orderType,
        product.title,
        product.subtitle,
        product.description,
        product.imageUrl,
        product.virtualPrice,
        product.compareAtPrice,
        product.virtualStock,
        product.virtualSalesCount,
        JSON.stringify(product.tags),
        product.status,
        product.recommendationWeight
      ]
    )
  }
}

async function seedCoupons(): Promise<void> {
  const coupons = [
    {
      id: 'coupon-new-user-80',
      title: '新人满399减80',
      description: '全场好物、外卖都可用，首单先领再买。',
      scope: 'all',
      thresholdAmount: 39900,
      discountAmount: 8000,
      totalQuantity: 100000,
      perUserLimit: 1,
      days: 30,
      sortOrder: 10
    },
    {
      id: 'coupon-shop-50',
      title: '商城满199减50',
      description: '数码、家居、零食等商品可用。',
      scope: 'shopping',
      thresholdAmount: 19900,
      discountAmount: 5000,
      totalQuantity: 80000,
      perUserLimit: 1,
      days: 20,
      sortOrder: 20
    },
    {
      id: 'coupon-food-30',
      title: '外卖满60减30',
      description: '奶茶、便当、夜宵统统安排。',
      scope: 'food_delivery',
      thresholdAmount: 6000,
      discountAmount: 3000,
      totalQuantity: 80000,
      perUserLimit: 1,
      days: 14,
      sortOrder: 30
    },
    {
      id: 'coupon-any-15',
      title: '无门槛15元券',
      description: '看到喜欢的就直接用。',
      scope: 'all',
      thresholdAmount: 0,
      discountAmount: 1500,
      totalQuantity: 120000,
      perUserLimit: 1,
      days: 10,
      sortOrder: 40
    },
    {
      id: 'coupon-big-120',
      title: '大件满999减120',
      description: '电脑、家电、露营装备等大件好价。',
      scope: 'shopping',
      thresholdAmount: 99900,
      discountAmount: 12000,
      totalQuantity: 50000,
      perUserLimit: 1,
      days: 30,
      sortOrder: 50
    }
  ]

  for (const coupon of coupons) {
    await exec(
      `INSERT INTO coupon_templates (
        id, title, description, scope, threshold_amount, discount_amount, total_quantity,
        per_user_limit, starts_at, ends_at, status, sort_order
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL ? DAY), 'active', ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), scope = VALUES(scope),
       threshold_amount = VALUES(threshold_amount), discount_amount = VALUES(discount_amount),
       total_quantity = VALUES(total_quantity), per_user_limit = VALUES(per_user_limit),
       ends_at = GREATEST(ends_at, VALUES(ends_at)), status = VALUES(status), sort_order = VALUES(sort_order)`,
      [
        coupon.id,
        coupon.title,
        coupon.description,
        coupon.scope,
        coupon.thresholdAmount,
        coupon.discountAmount,
        coupon.totalQuantity,
        coupon.perUserLimit,
        coupon.days,
        coupon.sortOrder
      ]
    )
  }
}

async function seedAdmin(): Promise<void> {
  const existingAdmins = await rows('SELECT id FROM admin_users LIMIT 1')
  if (existingAdmins.length > 0) return

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'admin123456', 10)
  await exec(
    `INSERT INTO admin_users (id, username, password_hash, display_name, created_at)
     VALUES (?, 'admin', ?, '假装购管理员', NOW())`,
    [`admin_${nanoid(10)}`, passwordHash]
  )
}
