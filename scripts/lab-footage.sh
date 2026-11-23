#!/usr/bin/env bash
# Rebuilds the material lab's footage loops from the originals in
# lab/footage-raw/ (see lab/footage/SOURCES.md for where to get them).
#   scripts/lab-footage.sh [repo root]
set -euo pipefail
cd "${1:-.}"
R=lab/footage-raw; O=lab/footage
V=(-c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good -cpu-used 4 -an -pix_fmt yuv420p)
ffmpeg -nostdin -v error -y -i $R/clouds.webm -filter_complex "[0:v]scale=1280:720,fps=30,split=3[a][b][c];[a]trim=0:2.5,setpts=PTS-STARTPTS[head];[b]trim=2.5:22.2,setpts=PTS-STARTPTS[mid];[c]trim=22.2:24.7,setpts=PTS-STARTPTS[tail];[tail][head]blend=all_expr='A*(1-T/2.5)+B*(T/2.5)'[x];[x][mid]concat=n=2:v=1:a=0[v]" -map "[v]" "${V[@]}" $O/sky.webm
ffmpeg -nostdin -v error -y -i $R/foliage.webm -filter_complex "[0:v]crop=1120:630:0:0,scale=1280:720,setpts=PTS*1.4,fps=30,split[f][r0];[r0]reverse[r];[f][r]concat=n=2:v=1:a=0[v]" -map "[v]" "${V[@]}" $O/foliage.webm
ffmpeg -nostdin -v error -y -i $R/ocean.webm -filter_complex "[0:v]crop=1280:720:0:360,fps=30,split=3[a][b][c];[a]trim=0:2,setpts=PTS-STARTPTS[head];[b]trim=2:26.8,setpts=PTS-STARTPTS[mid];[c]trim=26.8:28.8,setpts=PTS-STARTPTS[tail];[tail][head]blend=all_expr='A*(1-T/2)+B*(T/2)'[x];[x][mid]concat=n=2:v=1:a=0[v]" -map "[v]" "${V[@]}" $O/ocean.webm
for f in sky foliage ocean; do ffmpeg -nostdin -v error -y -i $O/$f.webm -frames:v 1 -q:v 4 $O/$f.jpg; done
# the lab blurs detail anyway: keep the committed loops small
for f in sky foliage ocean; do
  ffmpeg -nostdin -v error -y -i $O/$f.webm -vf scale=960:540 -c:v libvpx-vp9 -b:v 0 -crf 42 -row-mt 1 -deadline good -cpu-used 4 -an -pix_fmt yuv420p $O/$f.small.webm
  mv $O/$f.small.webm $O/$f.webm
  ffmpeg -nostdin -v error -y -i $O/$f.webm -frames:v 1 -q:v 5 $O/$f.jpg
done
ls -la $O
