import Taro from '@tarojs/taro'

const ADDRESS_KEY = 'fakemart_default_address'

const addresses = [
  '奥特曼 星期八 138****7788 光之国银河路 7 号 宇宙便利店楼上 302',
  '派大星 135****8866 比奇堡海底花园 菠萝街 2 号 妙妙屋门口',
  '章鱼哥 136****1024 比奇堡艺术中心 章鱼巷 8 号 二楼靠窗',
  '卡皮巴拉 137****5200 松弛市温泉小区 慢慢路 66 号 1 栋 808',
  '芝士猫 139****3344 云朵市奶盖大道 12 号 奶茶站旁 5 楼',
  '土豆队长 132****9090 快乐县薯条街 88 号 番茄酱公寓 1601'
]

function pickAddress(): string {
  const daySeed = new Date().getDate()
  return addresses[daySeed % addresses.length]
}

export function defaultAddress(): string {
  let current = Taro.getStorageSync<string>(ADDRESS_KEY)
  if (!current?.trim()) {
    current = pickAddress()
    Taro.setStorageSync(ADDRESS_KEY, current)
  }
  return current
}

export function setDefaultAddress(address: string): string {
  const next = address.trim()
  if (next) {
    Taro.setStorageSync(ADDRESS_KEY, next)
    return next
  }
  return defaultAddress()
}

export function syncDefaultAddress(address?: string | null): string {
  return address?.trim() ? setDefaultAddress(address) : defaultAddress()
}

export function addressShort(address = defaultAddress()): string {
  const parts = address.split(' ')
  return parts.length > 2 ? `${parts[0]} · ${parts.slice(2).join(' ')}` : address
}
