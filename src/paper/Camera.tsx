// The camera of a task from paper (R71): app's own, the device's camera at the back in a video,
// "Take photo" its shutter and "Choose from photos" a picture the device keeps, with the line to
// keep names out of the photo; no finding of the page while it is held, no flash. With no camera,
// or none the browser may use, the photos are the way in. The camera stops once the screen goes.
import { useEffect, useRef, useState } from "react";
import { IconButton } from "../app/IconButton.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type Photo, photoOfFile, photoOfVideo } from "./capture.ts";

type CameraState = "starting" | "live" | "none";

export function Camera({
  onPhoto,
  onClose,
}: {
  readonly onPhoto: (photo: Photo) => void;
  readonly onClose: () => void;
}) {
  const { words } = useLanguage();
  const video = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [unreadable, setUnreadable] = useState(false);
  const [taking, setTaking] = useState(false);

  useEffect(() => {
    const media = navigator.mediaDevices as MediaDevices | undefined;
    if (media?.getUserMedia === undefined) {
      setState("none");
      return;
    }
    let gone = false;
    let stream: MediaStream | undefined;
    media
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 4096 },
          height: { ideal: 4096 },
        },
        audio: false,
      })
      .then(
        (given) => {
          // A camera that answers after the screen went is stopped at once.
          if (gone) {
            for (const track of given.getTracks()) track.stop();
            return;
          }
          stream = given;
          const shown = video.current;
          if (shown !== null) {
            shown.srcObject = given;
            void shown.play().catch(() => {});
          }
          setState("live");
        },
        () => {
          if (!gone) setState("none");
        },
      );
    return () => {
      gone = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, []);

  const took = (made: Promise<Photo>) => {
    setTaking(true);
    setUnreadable(false);
    made.then(onPhoto, () => setUnreadable(true)).finally(() => setTaking(false));
  };

  return (
    <Screen
      title={words.text("paper.camera")}
      layout="task"
      bar={{ back: <IconButton value="close" onClick={onClose} /> }}
    >
      <div className="nt-camera">
        {state === "none" ? (
          <p className="nt-camera-none">{words.text("paper.no-camera")}</p>
        ) : (
          // The viewfinder is the page alone, with no sound: nothing to hear or caption.
          <video ref={video} className="nt-viewfinder" muted playsInline />
        )}
        <p className="nt-camera-names">{words.text("paper.names")}</p>
        {unreadable ? (
          <p role="alert" className="nt-camera-alert">
            {words.text("paper.unreadable")}
          </p>
        ) : null}
        <div className="nt-camera-row">
          <IconButton
            value="choose-photos"
            className="nt-camera-photos"
            {...(taking ? { "aria-disabled": true } : {})}
            onClick={() => {
              if (!taking) picker.current?.click();
            }}
          />
          {state === "none" ? null : (
            <IconButton
              value="take-photo"
              className="nt-shutter"
              {...(state !== "live" || taking ? { "aria-disabled": true } : {})}
              onClick={() => {
                const shown = video.current;
                if (state === "live" && !taking && shown !== null && shown.videoWidth > 0) {
                  took(photoOfVideo(shown));
                }
              }}
            />
          )}
        </div>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp,image/*"
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            // The same file picked again is a change too.
            event.currentTarget.value = "";
            if (file !== undefined) took(photoOfFile(file));
          }}
        />
      </div>
    </Screen>
  );
}
