import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SafeImage } from './SafeImage'
import houseIcon from '../assets/ui/fluent/house.webp'
import plateIcon from '../assets/ui/fluent/plate.webp'
import heartIcon from '../assets/ui/fluent/heart.webp'
import personIcon from '../assets/ui/fluent/person.webp'

type NavKey = 'home' | 'food' | 'cart' | 'profile'

const items: Array<{ key: NavKey; label: string; url: string; icon: string }> = [
  { key: 'home', label: '狂购', url: '/pages/index/index', icon: houseIcon },
  { key: 'food', label: '狂吃', url: '/pages/food/index', icon: plateIcon },
  { key: 'cart', label: '最爱', url: '/pages/cart/index', icon: heartIcon },
  { key: 'profile', label: 'Me', url: '/pages/profile/index', icon: personIcon }
]

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <View className='bottomNav'>
      {items.map((item) => (
        <View
            className={active === item.key ? `bottomNavItem bottomNavItem-${item.key} active` : `bottomNavItem bottomNavItem-${item.key}`}
          key={item.key}
          onClick={() => {
            const pages = Taro.getCurrentPages()
            const currentRoute = pages[pages.length - 1]?.route
            const currentPath = currentRoute ? `/${currentRoute}` : ''
            if (currentPath !== item.url) Taro.redirectTo({ url: item.url })
          }}
        >
          <View className='bottomNavIconWrap'>
            <SafeImage className='bottomNavImage' src={item.icon} mode='aspectFit' label={item.label} />
          </View>
          <Text className='bottomNavLabel'>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}
