// The lesson on the tile of each module's card on Home, by `ListLessons`: the lesson the answer
// names for the tile, its title, the step to go on with and how many it has. The cards show at
// once; a module with a current version, not solved on the sheet, takes its lesson when its answer
// has come, and one with no lessons, or whose answer did not come, has none: its card has the tile
// of its tasks alone. Each module is asked once while the screen is shown; the next showing of Home
// asks again, as a lesson may have begun or ended meanwhile.
import {
  LessonState,
  type ListLessonsResponse,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Api } from "../api/client.ts";
import type { LessonTile, ModuleCard } from "./modules.ts";

/**
 * The lesson of a module's tile, of what `ListLessons` gave: none when it gave none. Of an open run,
 * the step after the last of its task segments that ended; else the first.
 */
export function tileOf(answer: ListLessonsResponse): LessonTile | null {
  const lesson = answer.lessons.find((each) => each.lesson === answer.tileLesson);
  if (lesson === undefined) return null;
  const open = lesson.state === LessonState.OPEN;
  const last = open ? Math.max(0, ...lesson.endedSegments) : 0;
  return {
    lesson: lesson.lesson,
    title: lesson.title,
    step: Math.max(1, Math.min(last + 1, lesson.segments)),
    segments: lesson.segments,
    open,
  };
}

/** A card's key: the profile, the module and its version. */
const keyOf = (profileId: string, card: ModuleCard) =>
  JSON.stringify([profileId, card.moduleId, card.digest]);

/** The cards, each with the lesson of its tile once its answer has come; undefined while none. */
export function useLessonTiles(
  api: Api,
  profileId: string,
  cards: readonly ModuleCard[] | undefined,
): readonly ModuleCard[] | undefined {
  const [tiles, setTiles] = useState<ReadonlyMap<string, LessonTile | null>>(new Map());
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    for (const card of cards ?? []) {
      if (card.digest === undefined || card.sheet === true) continue;
      const key = keyOf(profileId, card);
      if (asked.current.has(key)) continue;
      asked.current.add(key);
      void api.learning.listLessons({ profileId, moduleId: card.moduleId }).then(
        (answer) => {
          if (mounted.current) setTiles((held) => new Map(held).set(key, tileOf(answer)));
        },
        () => {
          if (mounted.current) setTiles((held) => new Map(held).set(key, null));
        },
      );
    }
  }, [api, profileId, cards]);
  return useMemo(
    () =>
      cards?.map((card) => {
        if (card.digest === undefined || card.sheet === true) return { ...card, lesson: null };
        const tile = tiles.get(keyOf(profileId, card));
        return tile === undefined ? card : { ...card, lesson: tile };
      }),
    [cards, tiles, profileId],
  );
}
