import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Heart,
  MapPin,
  PackageCheck,
  Search,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  Truck,
  WalletCards,
} from 'lucide-react';

const COLORS = {
  coral: '#ff4f3d',
  yellow: '#ffd72e',
  pink: '#ff77ae',
  mint: '#6ee7bf',
  blue: '#4db8ff',
  ink: '#1f1b26',
  paper: '#fffaf3',
  white: '#ffffff',
};

const FONT = 'PingFang SC, Helvetica Neue, Arial, sans-serif';

const enter = (frame: number, delay = 0, damping = 14) =>
  spring({frame: frame - delay, fps: 30, config: {damping, stiffness: 170, mass: 0.7}});

const exit = (frame: number, at: number, duration = 12) =>
  interpolate(frame, [at, at + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const Noise: React.FC<{opacity?: number}> = ({opacity = 0.06}) => (
  <AbsoluteFill
    style={{
      opacity,
      mixBlendMode: 'multiply',
      backgroundImage:
        'url("data:image/svg+xml,%3Csvg viewBox=%270 0 180 180%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%27.9%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%27.55%27/%3E%3C/svg%3E")',
    }}
  />
);

const Blob: React.FC<{
  color: string;
  size: number;
  left: number;
  top: number;
  rotate?: number;
}> = ({color, size, left, top, rotate = 0}) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      width: size,
      height: size * 0.72,
      borderRadius: '48% 52% 58% 42% / 45% 42% 58% 55%',
      background: color,
      transform: `rotate(${rotate}deg)`,
      border: `7px solid ${COLORS.ink}`,
    }}
  />
);

const Sticker: React.FC<{
  children: React.ReactNode;
  color?: string;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({children, color = COLORS.white, rotate = 0, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      padding: '16px 25px',
      border: `6px solid ${COLORS.ink}`,
      borderRadius: 999,
      background: color,
      color: COLORS.ink,
      fontFamily: FONT,
      fontSize: 34,
      fontWeight: 800,
      boxShadow: `8px 9px 0 ${COLORS.ink}`,
      transform: `rotate(${rotate}deg)`,
      ...style,
    }}
  >
    {children}
  </div>
);

const Brand: React.FC<{inverse?: boolean}> = ({inverse = false}) => (
  <div style={{display: 'flex', alignItems: 'baseline', gap: 14, color: inverse ? COLORS.white : COLORS.ink}}>
    <span style={{fontFamily: FONT, fontSize: 48, fontWeight: 950}}>假装购</span>
    <span style={{fontFamily: FONT, fontSize: 24, fontWeight: 800, opacity: 0.78}}>FakeMart</span>
  </div>
);

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = exit(frame, 104, 16);
  const p1 = enter(frame, 4);
  const p2 = enter(frame, 18);
  const mascot = enter(frame, 42, 11);
  const spin = interpolate(frame, [0, 120], [-8, 5]);
  return (
    <AbsoluteFill style={{background: COLORS.yellow, opacity, overflow: 'hidden', fontFamily: FONT}}>
      <Blob color={COLORS.pink} size={430} left={-190} top={-80} rotate={-15} />
      <Blob color={COLORS.blue} size={330} left={820} top={250} rotate={24} />
      <Blob color={COLORS.mint} size={360} left={-120} top={1380} rotate={17} />
      <div style={{position: 'absolute', left: 64, top: 68}}><Brand /></div>
      <div style={{position: 'absolute', left: 62, top: 285, zIndex: 2}}>
        <div
          style={{
            fontSize: 128,
            fontWeight: 950,
            lineHeight: 1.02,
            letterSpacing: 0,
            transform: `translateY(${(1 - p1) * 130}px) rotate(-2deg)`,
            opacity: p1,
          }}
        >
          你不是
          <br />
          想买
        </div>
        <div
          style={{
            marginTop: 24,
            display: 'inline-block',
            padding: '15px 28px 20px',
            border: `7px solid ${COLORS.ink}`,
            background: COLORS.coral,
            color: COLORS.white,
            fontSize: 91,
            fontWeight: 950,
            transform: `translateX(${(1 - p2) * -180}px) rotate(2deg)`,
            boxShadow: `13px 14px 0 ${COLORS.ink}`,
            opacity: p2,
          }}
        >
          是想快乐一下
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          width: 650,
          height: 650,
          left: 430,
          bottom: 70,
          transform: `translateY(${(1 - mascot) * 430}px) scale(${0.55 + mascot * 0.45}) rotate(${spin}deg)`,
          filter: 'drop-shadow(22px 32px 0 rgba(31,27,38,.16))',
        }}
      >
        <Img src={staticFile('assets/shopping-mascot-cutout.png')} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      <Sticker color={COLORS.white} rotate={-7} style={{position: 'absolute', left: 72, bottom: 260, transform: `scale(${enter(frame, 62)}) rotate(-7deg)`}}>
        <Sparkles size={39} strokeWidth={3.5} /> 零压力逛一圈
      </Sticker>
      <Noise />
    </AbsoluteFill>
  );
};

const Phone: React.FC<{mode: 'shop' | 'food' | 'me'; frame: number}> = ({mode, frame}) => {
  const positions = {shop: '0%', food: '50%', me: '100%'} as const;
  return (
    <div
      style={{
        position: 'relative',
        width: 646,
        height: 1300,
        borderRadius: 76,
        border: `12px solid ${COLORS.ink}`,
        background: COLORS.white,
        boxShadow: `25px 30px 0 ${COLORS.ink}`,
        overflow: 'hidden',
      }}
    >
      <div style={{position: 'absolute', zIndex: 2, top: 16, left: '50%', width: 178, height: 38, borderRadius: 22, transform: 'translateX(-50%)', background: COLORS.ink}} />
      <Img
        src={staticFile('assets/app-board.jpg')}
        style={{
          position: 'absolute',
          width: '300%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: positions[mode],
          left: mode === 'shop' ? '0%' : mode === 'food' ? '-100%' : '-200%',
          top: 0,
          transform: `scale(${1 + Math.sin(frame / 22) * 0.006})`,
        }}
      />
    </div>
  );
};

const AppWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const phase = frame < 54 ? 'shop' : frame < 105 ? 'food' : 'me';
  const pop = enter(frame, 0, 12);
  return (
    <AbsoluteFill style={{background: COLORS.coral, overflow: 'hidden', fontFamily: FONT}}>
      <Blob color={COLORS.yellow} size={410} left={-180} top={80} rotate={20} />
      <Blob color={COLORS.mint} size={360} left={780} top={1280} rotate={-20} />
      <div style={{position: 'absolute', top: 64, left: 64}}><Brand inverse /></div>
      <div style={{position: 'absolute', left: 46, top: 180, transform: `translateY(${(1 - pop) * 160}px) rotate(-3deg) scale(${0.8 + pop * 0.2})`}}>
        <Phone mode={phase} frame={frame} />
      </div>
      <div style={{position: 'absolute', right: 54, top: 330, display: 'flex', flexDirection: 'column', gap: 34}}>
        {[
          ['狂购', COLORS.yellow, ShoppingBag],
          ['狂吃', COLORS.mint, Truck],
          ['最爱', COLORS.pink, Heart],
        ].map(([label, color, Icon], index) => {
          const active = (index === 0 && phase === 'shop') || (index === 1 && phase === 'food') || (index === 2 && phase === 'me');
          return (
            <div
              key={label as string}
              style={{
                width: 260,
                height: 160,
                border: `7px solid ${COLORS.ink}`,
                background: color as string,
                boxShadow: active ? `13px 15px 0 ${COLORS.ink}` : 'none',
                transform: `translateX(${active ? -38 : 0}px) rotate(${active ? -3 : 2}deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                fontSize: 47,
                fontWeight: 950,
              }}
            >
              <Icon size={49} strokeWidth={3.5} /> {label as string}
            </div>
          );
        })}
      </div>
      <Sticker color={COLORS.white} rotate={3} style={{position: 'absolute', right: 40, bottom: 140}}>
        想逛就逛 <ChevronRight size={42} strokeWidth={4} />
      </Sticker>
      <Noise />
    </AbsoluteFill>
  );
};

const StepCard: React.FC<{
  frame: number;
  delay: number;
  color: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rotate: number;
}> = ({frame, delay, color, title, subtitle, icon, rotate}) => {
  const p = enter(frame, delay, 12);
  return (
    <div
      style={{
        width: 840,
        height: 315,
        borderRadius: 42,
        border: `8px solid ${COLORS.ink}`,
        background: color,
        boxShadow: `18px 20px 0 ${COLORS.ink}`,
        display: 'grid',
        gridTemplateColumns: '210px 1fr 74px',
        alignItems: 'center',
        padding: '0 42px',
        transform: `translateX(${(1 - p) * 920}px) rotate(${rotate * p}deg)`,
        opacity: p,
      }}
    >
      <div style={{width: 150, height: 150, borderRadius: 38, border: `7px solid ${COLORS.ink}`, background: COLORS.white, display: 'grid', placeItems: 'center'}}>{icon}</div>
      <div>
        <div style={{fontSize: 66, fontWeight: 950}}>{title}</div>
        <div style={{fontSize: 31, fontWeight: 700, marginTop: 10, opacity: 0.75}}>{subtitle}</div>
      </div>
      <div style={{width: 66, height: 66, borderRadius: '50%', background: COLORS.ink, color: COLORS.white, display: 'grid', placeItems: 'center'}}><Check size={43} strokeWidth={4} /></div>
    </div>
  );
};

const Ritual: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: COLORS.mint, overflow: 'hidden', padding: '74px 70px', fontFamily: FONT, color: COLORS.ink}}>
      <Brand />
      <div style={{fontSize: 90, lineHeight: 1.05, fontWeight: 950, marginTop: 90}}>
        每一步
        <br />
        <span style={{color: COLORS.coral, WebkitTextStroke: `3px ${COLORS.ink}`, textShadow: `8px 9px 0 ${COLORS.ink}`}}>仪式感拉满</span>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 70, marginTop: 108, alignItems: 'center'}}>
        <StepCard frame={frame} delay={8} color={COLORS.yellow} title="先领券" subtitle="心动之前，先拿下快乐折扣" icon={<TicketPercent size={90} strokeWidth={3.3} />} rotate={-2} />
        <StepCard frame={frame} delay={35} color={COLORS.pink} title="再支付" subtitle="选择渠道，确认你的这一单" icon={<CreditCard size={90} strokeWidth={3.3} />} rotate={2} />
        <StepCard frame={frame} delay={64} color={COLORS.blue} title="等送达" subtitle="订单流转，每一步都有进度" icon={<PackageCheck size={90} strokeWidth={3.3} />} rotate={-1} />
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const EatAndShop: React.FC = () => {
  const frame = useCurrentFrame();
  const rider = enter(frame, 6, 13);
  return (
    <AbsoluteFill style={{background: COLORS.yellow, overflow: 'hidden', fontFamily: FONT, color: COLORS.ink}}>
      <div style={{position: 'absolute', left: 64, top: 68}}><Brand /></div>
      <div style={{position: 'absolute', left: 58, top: 250, zIndex: 3}}>
        <div style={{fontSize: 102, fontWeight: 950, lineHeight: 1.02}}>奶茶 夜宵</div>
        <div style={{fontSize: 102, fontWeight: 950, lineHeight: 1.02, color: COLORS.coral}}>好物 新品</div>
        <div style={{fontSize: 44, fontWeight: 800, marginTop: 40}}>今晚想要的，都安排上。</div>
      </div>
      <div style={{position: 'absolute', width: 890, height: 890, left: 270, bottom: 38, transform: `translateX(${(1 - rider) * 900}px) rotate(${(1 - rider) * 16 - 5}deg)`, filter: 'drop-shadow(25px 30px 0 rgba(31,27,38,.17))'}}>
        <Img src={staticFile('assets/delivery-mascot-cutout.png')} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      {[
        ['bubble-tea.png', 80, 730, -12, 0],
        ['hamburger.png', 780, 570, 11, 16],
        ['headphone.png', 110, 1160, 8, 28],
        ['lipstick.png', 805, 1180, -10, 38],
      ].map(([name, left, top, rotate, delay]) => {
        const p = enter(frame, delay as number, 11);
        return (
          <div key={name as string} style={{position: 'absolute', left: left as number, top: top as number, width: 190, height: 190, borderRadius: 48, border: `7px solid ${COLORS.ink}`, background: COLORS.white, boxShadow: `12px 14px 0 ${COLORS.ink}`, transform: `scale(${p}) rotate(${rotate as number}deg)`, display: 'grid', placeItems: 'center'}}>
            <Img src={staticFile(`assets/${name as string}`)} style={{width: 128, height: 128, objectFit: 'contain'}} />
          </div>
        );
      })}
      <Sticker color={COLORS.coral} rotate={-4} style={{position: 'absolute', left: 66, bottom: 120, color: COLORS.white}}>
        <Clock3 size={40} strokeWidth={3.5} /> 快乐正在送达
      </Sticker>
      <Noise />
    </AbsoluteFill>
  );
};

const Ledger: React.FC = () => {
  const frame = useCurrentFrame();
  const amount = interpolate(frame, [15, 125], [0, 216.5], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const receipt = enter(frame, 2, 13);
  return (
    <AbsoluteFill style={{background: COLORS.blue, overflow: 'hidden', fontFamily: FONT, color: COLORS.ink}}>
      <Blob color={COLORS.pink} size={420} left={-180} top={1320} rotate={18} />
      <Blob color={COLORS.yellow} size={390} left={790} top={-80} rotate={-18} />
      <div style={{position: 'absolute', left: 64, top: 68}}><Brand /></div>
      <div style={{position: 'absolute', left: 74, top: 240}}>
        <div style={{fontSize: 94, fontWeight: 950, lineHeight: 1.05}}>忍住的每一单</div>
        <div style={{fontSize: 94, fontWeight: 950, lineHeight: 1.05, color: COLORS.white, WebkitTextStroke: `3px ${COLORS.ink}`, textShadow: `9px 10px 0 ${COLORS.ink}`}}>都是成就感</div>
      </div>
      <div style={{position: 'absolute', left: 110, top: 590, width: 860, minHeight: 1020, padding: '78px 72px', background: COLORS.paper, border: `9px solid ${COLORS.ink}`, boxShadow: `22px 25px 0 ${COLORS.ink}`, transform: `translateY(${(1 - receipt) * 900}px) rotate(${(1 - receipt) * 6 - 1.5}deg)`, clipPath: 'polygon(0 0,100% 0,100% 96%,96% 100%,92% 96%,88% 100%,84% 96%,80% 100%,76% 96%,72% 100%,68% 96%,64% 100%,60% 96%,56% 100%,52% 96%,48% 100%,44% 96%,40% 100%,36% 96%,32% 100%,28% 96%,24% 100%,20% 96%,16% 100%,12% 96%,8% 100%,4% 96%,0 100%)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontSize: 54, fontWeight: 950}}>省钱账本</div>
          <WalletCards size={62} strokeWidth={3.4} />
        </div>
        <div style={{borderTop: `5px dashed ${COLORS.ink}`, margin: '38px 0 52px'}} />
        <div style={{fontSize: 34, fontWeight: 800, opacity: 0.68}}>本月已省</div>
        <div style={{fontSize: 122, fontWeight: 950, color: COLORS.coral, marginTop: 8}}>¥{amount.toFixed(2)}</div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 58}}>
          {[
            [Heart, '收藏心动', '23 次', COLORS.pink],
            [ShoppingBag, '快乐下单', '8 单', COLORS.yellow],
            [Search, '浏览足迹', '156 条', COLORS.mint],
            [TicketPercent, '优惠券', '20 张', COLORS.blue],
          ].map(([Icon, label, value, color]) => (
            <div key={label as string} style={{height: 178, border: `5px solid ${COLORS.ink}`, background: color as string, padding: 24, borderRadius: 24}}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}><span style={{fontSize: 29, fontWeight: 800}}>{label as string}</span><Icon size={38} strokeWidth={3.4} /></div>
              <div style={{fontSize: 46, fontWeight: 950, marginTop: 24}}>{value as string}</div>
            </div>
          ))}
        </div>
        <div style={{borderTop: `5px dashed ${COLORS.ink}`, margin: '50px 0 35px'}} />
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 30, fontWeight: 800}}><span>快乐已签收</span><span>压力已退回</span></div>
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const p = enter(frame, 0, 12);
  const glow = 1 + Math.sin(frame / 7) * 0.025;
  return (
    <AbsoluteFill style={{background: COLORS.coral, overflow: 'hidden', fontFamily: FONT, color: COLORS.ink, alignItems: 'center', justifyContent: 'center'}}>
      <Blob color={COLORS.yellow} size={600} left={-260} top={-120} rotate={18} />
      <Blob color={COLORS.mint} size={480} left={780} top={1280} rotate={-20} />
      <Blob color={COLORS.pink} size={300} left={-90} top={1450} rotate={12} />
      <div style={{position: 'absolute', top: 210, width: 420, height: 420, transform: `scale(${p * glow}) rotate(${(1 - p) * -18}deg)`, filter: 'drop-shadow(18px 24px 0 rgba(31,27,38,.22))'}}>
        <Img src={staticFile('assets/shopping-mascot-cutout.png')} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      <div style={{textAlign: 'center', marginTop: 380, transform: `translateY(${(1 - p) * 100}px)`, opacity: p}}>
        <div style={{fontSize: 150, fontWeight: 950, color: COLORS.white, WebkitTextStroke: `5px ${COLORS.ink}`, textShadow: `13px 15px 0 ${COLORS.ink}`}}>假装购</div>
        <div style={{fontSize: 52, fontWeight: 900, marginTop: 35}}>把购物的快乐留下</div>
        <div style={{fontSize: 52, fontWeight: 900}}>把钱包的压力放下</div>
      </div>
      <div style={{position: 'absolute', bottom: 195, display: 'flex', alignItems: 'center', gap: 22, padding: '24px 34px', background: COLORS.white, border: `7px solid ${COLORS.ink}`, boxShadow: `12px 14px 0 ${COLORS.ink}`, transform: `scale(${enter(frame, 35)}) rotate(-2deg)`}}>
        <MapPin size={45} strokeWidth={3.5} />
        <span style={{fontSize: 33, fontWeight: 850}}>fakemart.beatconnects.com</span>
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

export const FakeMartPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: COLORS.coral}}>
      <Audio src={staticFile('audio/music.wav')} volume={0.12} />
      <Audio src={staticFile('audio/voiceover.wav')} volume={1} />
      <Sequence from={0} durationInFrames={120}><Intro /></Sequence>
      <Sequence from={120} durationInFrames={150}><AppWorld /></Sequence>
      <Sequence from={270} durationInFrames={180}><Ritual /></Sequence>
      <Sequence from={450} durationInFrames={150}><EatAndShop /></Sequence>
      <Sequence from={600} durationInFrames={180}><Ledger /></Sequence>
      <Sequence from={780} durationInFrames={120}><EndCard /></Sequence>
    </AbsoluteFill>
  );
};
