# PoapArtBot
_Automated drawing interface for poap.art_

This tool automates the drawing of images (later: text, ...) on the [poap.art website](poap.art).
Simply drag-and-drop your image on the canvas and start drawing. It will approximate the colors to the limited set of 256,
so the colors of your image might look a bit different than expected.


## Usage
__I know this is ugly, it's still in development. It's just a PoC.__ \
At the moment this is hardcoded for the ongoing weekly sandbox canvas. \
You'll need python3 installed
(`sudo apt-get install python3` for linux).
1. Download the repository
2. Run `StartBot.sh` (this will start a local HTTP server) 
3. Scroll down to the buttons
4. Open metamask
5. Login (by signing the message)
6. Drag-and-Drop an image you like onto the canvas. After droppping you can grab it again, or scale it while pressing `CTRL`.
7. Once you're happy, hit start!
8. (Don't forget to stop your HTTP-Server when you're done: Hit `Ctrl + c` in the terminal window.)


## Contribute
Unfortunately, [poap.art](poap.art) isn't open source (let's hope it will be soon!),
so I basically needed to rebuilt all the relevant client parts of it.
I'm no professional at reverse engineering websites and didn't even do anything with js before really,
so there's definitely a lot you could help with. \
most important tasks:
- refactor ui: I'm currently only focusing on core features (that's a lot). I don't have the time atm to also learn
react or vue.
