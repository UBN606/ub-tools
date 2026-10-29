# Episodes: one UBN article becomes one YouTube video

`make_episode.py` turns one article from `app/ubn-articles.json` into a finished
episode on your own Windows PC:

- **Voice**: Kokoro-82M, a local text-to-speech model. Its code and voice
  weights are under the Apache-2.0 license, which allows commercial use, so a
  monetized channel is fine. Book names are spoken using `app/pronounce.json`
  ("Nebadon" is said as "Nehbuhdahn"), the same list the Studio's Read aloud uses.
- **Quotes**: every quotation in the script is checked word for word with
  `ub-verify.js`. If any quote fails, the build stops and makes no video.
- **Captions**: faster-whisper listens to the narration and `audio/align.py`
  matches each word to the moment it is spoken. You get an `.srt` file to upload
  to YouTube. Book names appear in their normal spelling.
- **Quote cards**: each verified quote of 6 or more words fills the screen while
  it is read, drawn with the `quote-cards/` design.
- **Background**: video clips from your ComfyUI LTX workflow, made through
  ComfyUI's API. You get one prompt per chapter, and you can edit it.
- **Ending**: a closing still (one is drawn for you, or you can use your own)
  with your music.
- **Description**: the article link, YouTube chapters, and every quoted passage
  as a Paper:Section.Paragraph reference.

## Install (once)

1. Install these four programs. Open **PowerShell** and paste each line, one at a time:

   ```
   winget install Python.Python.3.12
   ```
   ```
   winget install OpenJS.NodeJS.LTS
   ```
   ```
   winget install Gyan.FFmpeg
   ```
   ```
   winget install Git.Git
   ```

   Then close PowerShell and open it again, so it can find the new programs.
   Kokoro only works with Python 3.10 to 3.12. Python 3.13 will not work, so
   install 3.12 even if you already have a newer Python.

2. Download ub-tools:

   ```
   cd $HOME\Documents
   ```
   ```
   git clone https://github.com/UBN606/ub-tools
   ```

3. In File Explorer, open `Documents\ub-tools\episodes` and double-click
   **setup.bat**. It installs everything else and downloads the book text that
   the quote check uses. This takes about 10 minutes. The first time you build
   a video, it also downloads the voice (about 350 MB) and the caption model.

4. Set up ComfyUI to make the clips (this is done once):
   - Open your LTX video workflow in ComfyUI and check that it makes a clip.
   - In the **positive prompt** box, replace the text with exactly `{{PROMPT}}`.
     If you want, type `{{NEGATIVE}}` in the negative prompt box.
   - The workflow must save an **.mp4 or .webm** file, using the core
     **Save Video** node or **Video Combine** with an mp4 format. Animated WebP
     won't work.
   - Use the menu **Workflow → Export (API)**. In older ComfyUI, first turn on
     "Dev mode" in Settings, then use **Save (API Format)**. Save the file as
     `Documents\ub-tools\episodes\ltx_workflow_api.json`.
   - The script picks new random seeds itself. Your workflow decides how long
     each clip is. If your clips are not about 5 seconds long, add
     `--clip-seconds 8` (or whatever your length is) to the build command.

## Make an episode

Run these in PowerShell from the `ub-tools` folder (`cd $HOME\Documents\ub-tools`).

**1. Find the article's short name (its "slug"):**

```
.\episodes\episode list cheer
```

**2. Prepare the script:**

```
.\episodes\episode prepare be-of-good-cheer
```

This downloads the article and writes two files to `episodes\work\be-of-good-cheer\`:

- `script.md` is exactly what will be spoken. **Read it all the way through.**
  Delete anything that shouldn't be read aloud, such as bylines, image
  captions or "share this" text. Lines that start with `## ` become chapters.
  A quote should be the book's exact words in quotation marks, followed by its
  reference, for example `(146:2.12)`. References appear on screen but are not
  spoken.
- `visuals.json` holds one picture prompt per chapter. The defaults are
  generic, so write prompts that suit each chapter. The `negative` line already
  rules out text, faces, wings, halos and church imagery.

If the download fails, open the article in your browser, copy the text into a
`.txt` file (leave a blank line between paragraphs and put `## ` before each
heading), and run:

```
.\episodes\episode prepare be-of-good-cheer --article-file C:\path\to\article.txt
```

**3. Build the video.** Start ComfyUI first, then run:

```
.\episodes\episode build be-of-good-cheer --music "C:\Music\track.mp3" --music-credit "Track name by Artist"
```

The finished files appear in `episodes\work\be-of-good-cheer\`:

| File | What to do with it |
|---|---|
| `be-of-good-cheer.mp4` | Upload this video |
| `be-of-good-cheer.en.srt` | In YouTube Studio, go to Subtitles, choose Upload file, then "With timing" |
| `description.txt` | Paste it into the description box |

**Watch the whole video before you upload it.** Listen for words the voice
mispronounces, check that the captions keep up with the speech, and look at
every clip, because AI video sometimes comes out strange. If a clip is bad,
delete it from `work\<slug>\clips\` (files named `ch02_...mp4` belong to
chapter 3) and run the build again. Only the missing clip is made again. If you
edit one paragraph in `script.md`, only that paragraph is spoken again.

### Useful options

| Option | What it does |
|---|---|
| `--voice am_michael` | Uses a different voice. The default `af_heart` is a US English female voice. Others: `af_bella`, `am_michael`, `bf_emma`, `bm_george` |
| `--speed 0.95` | Slows the voice down a little |
| `--no-comfy` | Uses a plain dark background instead of clips. Good for a quick first test |
| `--end-still my.png` | Uses your own closing image (Blender render, Canva, etc.) |
| `--end-seconds 30` | Changes how long the closing still and music last (the default is 20 seconds) |
| `--music-volume 0.4` | Makes the closing music quieter |
| `--no-align` | Skips faster-whisper. Caption timing is spread evenly instead (less exact) |

## Good to know

- **Music**: use only tracks you have the rights to use on a monetized channel,
  and put the credit the license asks for in `--music-credit`.
- **AI disclosure**: YouTube asks creators to label realistic altered or
  synthetic content when they upload. Read the current wording of that question
  and answer it honestly for the voice and the clips.
- **A mispronounced word**: add it to `app/pronounce.json` under `"say"`, with
  the way it should sound, then build again.
- Kokoro and faster-whisper run on the processor, so the graphics card is free
  for ComfyUI. Clip generation is the slowest step.
