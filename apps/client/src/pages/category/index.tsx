import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { Category, Product } from '@fakemart/shared'
import { BottomNav } from '../../components/BottomNav'
import { ProductCard } from '../../components/ProductCard'
import { SafeImage } from '../../components/SafeImage'
import booksIcon from '../../assets/ui/fluent/books.webp'
import cameraIcon from '../../assets/ui/fluent/camera.webp'
import couchIcon from '../../assets/ui/fluent/couch.webp'
import cupStrawIcon from '../../assets/ui/fluent/cup-straw.webp'
import dressIcon from '../../assets/ui/fluent/dress.webp'
import gridIcon from '../../assets/ui/fluent/grid.webp'
import lipstickIcon from '../../assets/ui/fluent/lipstick.webp'
import soccerIcon from '../../assets/ui/fluent/soccer.webp'
import { ensureAuth, request, sessionId, track } from '../../lib/api'
import './index.scss'

type SortKey = 'recommend' | 'price_asc' | 'price_desc' | 'newest'

const sortOptions: Array<{ label: string; value: SortKey }> = [
  { label: '推荐', value: 'recommend' },
  { label: '低价优先', value: 'price_asc' },
  { label: '高价优先', value: 'price_desc' },
  { label: '上新', value: 'newest' }
]

const categoryAssets: Record<string, string> = {
  digital: cameraIcon,
  beauty: lipstickIcon,
  home: couchIcon,
  fashion: dressIcon,
  snacks: cupStrawIcon,
  books: booksIcon,
  sport: soccerIcon
}

export default function CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recommend')

  async function load(nextCategoryId = categoryId, nextKeyword = keyword, nextMerchantId = merchantId, nextSortKey = sortKey) {
    await ensureAuth()
    const query = new URLSearchParams({ orderType: 'shopping', limit: '60', sort: nextSortKey })
    if (nextCategoryId) query.set('categoryId', nextCategoryId)
    if (nextMerchantId) query.set('merchantId', nextMerchantId)
    if (nextKeyword) query.set('q', nextKeyword)
    const [categoryResult, productResult] = await Promise.all([
      request<{ categories: Category[] }>('/catalog/categories'),
      request<{ products: Product[] }>(`/catalog/products?${query.toString()}`)
    ])
    setCategories(categoryResult.categories.filter((item) => item.slug !== 'takeaway'))
    setProducts(productResult.products)
    track('category_view', { categoryId: nextCategoryId || 'all', merchantId: nextMerchantId || '', q: nextKeyword }, '/pages/category/index')
  }

  useDidShow(() => {
    const pendingCategoryId = Taro.getStorageSync<string>('fakemart_pending_category_id') || ''
    const pendingMerchantId = Taro.getStorageSync<string>('fakemart_pending_merchant_id') || ''
    const pendingMerchantName = Taro.getStorageSync<string>('fakemart_pending_merchant_name') || ''
    const pendingQuery = Taro.getStorageSync<string>('fakemart_pending_category_query') || ''
    Taro.removeStorageSync('fakemart_pending_category_id')
    Taro.removeStorageSync('fakemart_pending_merchant_id')
    Taro.removeStorageSync('fakemart_pending_merchant_name')
    Taro.removeStorageSync('fakemart_pending_category_query')
    if (pendingCategoryId) setCategoryId(pendingCategoryId)
    if (pendingMerchantId) setMerchantId(pendingMerchantId)
    if (pendingMerchantName) setMerchantName(pendingMerchantName)
    if (pendingQuery) setKeyword(pendingQuery)
    load(pendingCategoryId || categoryId, pendingQuery || keyword, pendingMerchantId || merchantId, sortKey).catch((error) => console.warn(error))
  })

  async function addCart(product: Product) {
    await request('/cart/items', 'POST', { productId: product.id, quantity: 1, sessionId: sessionId() })
    await track('add_to_cart', { productId: product.id }, '/pages/category/index')
    Taro.showToast({ title: '已加入最爱', icon: 'success' })
  }

  async function selectCategory(id: string) {
    setCategoryId(id)
    setMerchantId('')
    setMerchantName('')
    await load(id, keyword, '', sortKey)
  }

  async function submitSearch(value: string) {
    const term = value.trim()
    setKeyword(term)
    await track('search_submit', { term }, '/pages/category/index')
    await load(categoryId, term, merchantId, sortKey)
  }

  async function changeSort(value: SortKey) {
    setSortKey(value)
    await load(categoryId, keyword, merchantId, value)
  }

  function backHome() {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
      return
    }
    Taro.redirectTo({ url: '/pages/index/index' })
  }

  const activeCategory = categories.find((category) => category.id === categoryId)
  const activeTitle = merchantName || (activeCategory ? displayCategoryName(activeCategory) : keyword ? '搜索结果' : '商品分类')

  return (
    <View className='page categoryLayout'>
      <View className='categoryTopBar'>
        <View className='categoryBackButton' onClick={backHome}>
          <Text className='categoryBackIcon'>‹</Text>
          <Text className='categoryBackText'>狂购</Text>
        </View>
        <Text className='categoryTopTitle'>{activeTitle}</Text>
        <Text className='categoryCount'>{products.length} 款</Text>
      </View>

      <View className='categoryHero'>
        <View className='categoryHeroCopy'>
          <Text className='categoryHeroEyebrow'>狂购分类</Text>
          <Text className='categoryHeroTitle'>{activeTitle}</Text>
          <Text className='categoryHeroText'>{merchantName ? '正在看这个店铺的好物' : keyword ? `搜索「${keyword}」相关好物` : '挑一个分类，马上进入好物现场。'}</Text>
        </View>
        <View className='categoryHeroIcon'>
          <SafeImage className='categoryHeroImage' src={activeCategory ? categoryIcon(activeCategory) : gridIcon} mode='aspectFit' label={activeTitle} />
        </View>
      </View>

      <View className='categorySearch'>
        <Input
          value={keyword}
          placeholder='搜索手机、香薰、口红、零食'
          confirmType='search'
          onInput={(event) => setKeyword(String(event.detail.value))}
          onConfirm={(event) => submitSearch(String(event.detail.value))}
        />
        <View className='categorySearchButton' onClick={() => submitSearch(keyword)}>
          <Text>搜索</Text>
        </View>
      </View>

      <ScrollView className='categoryTabs' scrollX>
        <View className='categoryTabTrack'>
          <View className={categoryId ? 'categoryPill' : 'categoryPill active'} onClick={() => selectCategory('')}>
            <SafeImage className='categoryPillIcon' src={gridIcon} mode='aspectFit' label='全部' />
            <Text>全部</Text>
          </View>
          {categories.map((category) => (
            <View className={categoryId === category.id ? 'categoryPill active' : 'categoryPill'} key={category.id} onClick={() => selectCategory(category.id)}>
              <SafeImage className='categoryPillIcon' src={categoryIcon(category)} mode='aspectFit' label={category.name} />
              <Text>{displayCategoryName(category)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {merchantName && (
        <View className='merchantFilter'>
          <Text className='merchantFilterText'>正在看 {merchantName}</Text>
          <Text
            className='merchantFilterClear'
            onClick={() => {
              setMerchantId('')
              setMerchantName('')
              load(categoryId, keyword, '', sortKey).catch((error) => console.warn(error))
            }}
          >
            全部店铺
          </Text>
        </View>
      )}

      <View className='categorySortRow'>
        {sortOptions.map((item) => (
          <View className={sortKey === item.value ? 'categorySort active' : 'categorySort'} key={item.value} onClick={() => changeSort(item.value)}>
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>

      <View className='categoryResultHead'>
        <Text>{activeTitle}</Text>
        <Text>{products.length} 款好物</Text>
      </View>

      <View className='productGrid categoryProductGrid'>
        {products.length === 0 ? (
          <View className='categoryEmptyState'>
            <SafeImage className='categoryEmptyIcon' src={gridIcon} mode='aspectFit' label='商品' />
            <Text>这组还没上新</Text>
            <Text>换个关键词或点上面的分类看看</Text>
          </View>
        ) : products.map((product) => (
          <ProductCard product={product} key={product.id} onAddCart={addCart} variant='grid' />
        ))}
      </View>
      <BottomNav active='home' />
    </View>
  )
}

function categoryIcon(category: Category): string {
  return categoryAssets[category.slug] ?? gridIcon
}

function displayCategoryName(category: Category): string {
  return category.slug === 'beauty' ? '美妆护肤' : category.name
}
