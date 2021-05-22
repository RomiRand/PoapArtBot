# PoapArtBot
_Automated drawing interface for poap.art_

This tool automates the drawing of images (later: text, ...) on the [poap.art website](poap.art).

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
Unfortunately, the website isn't open source (let's hope it will be soon!), so I basically needed to rebuilt all the relevant parts of it.
I'm no professional at reverse engineering websites and didn't even do anything with js really, so there's definetly a lot you could help with. \
most important tasks:
- fix canvas construction: There's two apis which can be used to built the canvas, `chunk` and `pixel`. `pixel` is more of a live endpoint, but `chunk` seems to update less often (around once a day?). Most likely you can query these apis, I just didn't find out how yet.
- refactor ui: I'm currently only focusing on core features (that's a lot) 
