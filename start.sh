#!/bin/sh
cd ~/minecraftpipebomb/
~/.deno/bin/deno run --allow-net --allow-read --allow-write main.ts --output=/var/www/duncy/doomsday.json >> out.log

