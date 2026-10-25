import { Composition } from "remotion";
import { Video, TOTAL_FRAMES } from "./Video";

export const Root: React.FC = () => (
  <Composition
    id="Parallax"
    component={Video}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
);
