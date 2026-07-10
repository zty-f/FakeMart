import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Product } from '@fakemart/shared'
import { formatMoney } from '../lib/api'
import { SafeImage } from './SafeImage'

interface Props {
  product: Product
  onAddCart?: (product: Product) => void
  compact?: boolean
  variant?: 'grid' | 'horizontal'
}

export function ProductCard({ product, onAddCart, compact, variant = 'horizontal' }: Props) {
  const className = ['productCard', compact ? 'compact' : variant].filter(Boolean).join(' ')
  const saved = Math.max(product.compareAtPrice - product.virtualPrice, product.virtualPrice)

  return (
    <View className={className}>
      <View className='productMedia' onClick={() => Taro.navigateTo({ url: `/pages/product/detail?id=${product.id}` })}>
        <SafeImage className='productImage' mode='aspectFill' src={product.imageUrl} label={product.title} />
        <Text className='productBadge'>{product.orderType === 'food_delivery' ? '外卖' : '好物'}</Text>
      </View>
      <View className='productBody' onClick={() => Taro.navigateTo({ url: `/pages/product/detail?id=${product.id}` })}>
        <Text className='productTitle'>{product.title}</Text>
        <Text className='productSubtitle'>{product.subtitle}</Text>
        <View className='productTags'>
          {product.tags.slice(0, 2).map((tag) => (
            <Text key={tag}>{tag}</Text>
          ))}
        </View>
        <Text className='saveLine'>预计省 {formatMoney(saved)}</Text>
        <View className='productFoot'>
          <Text className='price'>{formatMoney(product.virtualPrice)}</Text>
          <Text className='compare'>{formatMoney(product.compareAtPrice)}</Text>
        </View>
      </View>
      {onAddCart && (
        <View
          className='addButton'
          onClick={(event) => {
            event.stopPropagation()
            onAddCart(product)
          }}
        >
          <Text>+</Text>
        </View>
      )}
    </View>
  )
}
