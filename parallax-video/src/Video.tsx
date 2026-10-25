import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile } from "remotion";
import { C, SceneProps } from "./theme";
import { Open, Trap, Title } from "./scenes/Intro";
import { Ledger, Carry, Witness, Moat } from "./scenes/Engine";
import { Dashboard } from "./scenes/Dashboard";
import { Attribution, Phone, End } from "./scenes/Outro";
import timeline from "./timeline.json";

// timeline.json is written by scripts/timeline.py from the voiceover lengths.
const COMPONENTS: Record<string, React.FC<SceneProps>> = {
  open: Open,
  trap: Trap,
  title: Title,
  ledger: Ledger,
  carry: Carry,
  witness: Witness,
  moat: Moat,
  dash: Dashboard,
  attr: Attribution,
  phone: Phone,
  end: End,
};

export const TOTAL_FRAMES = timeline.total;

export const Video: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    {timeline.scenes.map((s) => {
      const Comp = COMPONENTS[s.name];
      return (
        <Sequence key={s.name} name={s.name} from={s.start} durationInFrames={s.dur}>
          <Comp ev={s.ev as unknown as Record<string, number>} dur={s.dur} />
        </Sequence>
      );
    })}
    {/* score and sound effects are pre-mixed to the same timeline by scripts/audio.py */}
    <Html5Audio src={staticFile("music.wav")} volume={0.9} />
    <Html5Audio src={staticFile("sfx.wav")} volume={0.85} />
    {timeline.scenes.flatMap((s) =>
      s.vo.map((v) => (
        <Sequence key={v.id} name={`vo ${v.id}`} from={s.start + v.from} durationInFrames={v.len + 10}>
          <Html5Audio src={staticFile(`vo/${v.id}.mp3`)} volume={1} />
        </Sequence>
      )),
    )}
  </AbsoluteFill>
);
