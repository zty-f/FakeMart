import { Image, Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'

type ImageMode = 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix'

interface Props {
  className: string
  src?: string | null
  mode?: ImageMode
  label?: string
}

export function SafeImage({ className, src, mode = 'aspectFill', label = '精选' }: Props) {
  const [failed, setFailed] = useState(!src)

  useEffect(() => {
    setFailed(!src)
  }, [src])

  if (failed) {
    return (
      <View className={`${className} safeImageFallback`}>
        <Text>{label.slice(0, 4) || '精选'}</Text>
      </View>
    )
  }

  return (
    <Image
      className={className}
      mode={mode}
      src={src || ''}
      onError={() => setFailed(true)}
      onLoad={() => setFailed(false)}
    />
  )
}
