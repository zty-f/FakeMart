import React from 'react';
import {Composition} from 'remotion';
import {FakeMartPromo} from './FakeMartPromo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FakeMartPromo"
      component={FakeMartPromo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
