import { Image, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'

type ImageMode = 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix'

interface Props {
  className: string
  src?: string | null
  mode?: ImageMode
  label?: string
}

export function SafeImage({ className, src, mode = 'aspectFill', label = '精选' }: Props) {
  const [failed, setFailed] = useState(!src)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFailed(!src)
    if (src) {
      timeoutRef.current = setTimeout(() => setFailed(true), 3500)
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
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
      onLoad={() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }}
    />
  )
}
