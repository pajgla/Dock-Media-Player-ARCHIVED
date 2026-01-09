import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import Pango from 'gi://Pango';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';

export const MediaWidget = GObject.registerClass(
    class MediaWidget extends St.BoxLayout
    {
        _init()
        {
            super._init({
                style_class: "media-player-widget",
                vertical: false,
                x_expand: false,
                y_expand: false,
            });

            this._rightSideContainer = new St.BoxLayout({
                vertical: true,
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._artistControlsRow = new St.BoxLayout({
                vertical: false,
                x_expand: true,
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._musicMetadata = new St.BoxLayout({
                style_class: "media-metadata",
                vertical: true,
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._musicControls = new St.BoxLayout({
                style_class: "media-controls",
                vertical: false,
                x_expand: false,
                y_expand: true,
                // Change this from END to START
                x_align: Clutter.ActorAlign.END, 
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._playPauseButton = new St.Button({
                style_class: "media-play-pause-button",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._nextButton = new St.Button({
                style_class: "music-next-button",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._previousButton = new St.Button({
                style_class: "music-previous-button",
                y_align: Clutter.ActorAlign.CENTER,
            })

            this._musicArtist = new St.Label({
                style_class: "media-music-artist",
                text: "Unknown Artist",
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._musicArtist.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            // this._musicArtist.clutter_text.min_width = 50;
            // this._musicArtist.clutter_text.max_width = 50;

            this._musicTitle = new St.Label({
                style_class: "media-music-title",
                text: "Unknown Title",
                y_align: Clutter.ActorAlign.CENTER,
            });
            // Access the internal clutter text
            this._musicTitle.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            // This forces a minimum "natural" width so 6-letter songs don't make the widget tiny
            // this._musicTitle.clutter_text.min_width = 50; 
            // // This forces a maximum width so YouTube titles don't make the widget huge
            // this._musicTitle.clutter_text.max_width = 50;
            //this._musicTitle.y_align = Clutter.ActorAlign.CENTER;
            //this._musicArtist.y_align = Clutter.ActorAlign.CENTER;
            
            this._musicTitle.x_expand = true;
            this._musicArtist.x_expand = true;

            this._artistControlsRow.add_child(this._musicArtist);
            this._artistControlsRow.add_child(this._musicControls);

            this._rightSideContainer.add_child(this._musicTitle);
            this._rightSideContainer.add_child(this._artistControlsRow);

            this._musicAlbumArt = new St.Bin({
                style_class: "media-album-art",
                y_align: Clutter.ActorAlign.CENTER,
                clip_to_allocation: true,
            });

            this._musicAlbumArtFallback = new St.Icon({
                style_class: "music-album-art-fallback",
                icon_name: "audio-x-generic-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.playIcon = new St.Icon({
                style_class: "music-play-icon",
                icon_name: "media-playback-start-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.pauseIcon = new St.Icon({
                style_class: "music-pause-icon",
                icon_name: "media-playback-pause-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.nextIcon = new St.Icon({
                style_class: "music-next-icon",
                icon_name: "media-skip-forward-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.previousIcon = new St.Icon({
                style_class: "music-next-icon",
                icon_name: "media-skip-backward-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            })

            this._musicMetadata.add_child(this._musicTitle);
            this._musicMetadata.add_child(this._musicArtist);
            //this._musicMetadata.add_child(this._musicControls);
            this._musicAlbumArt.set_child(this._musicAlbumArtFallback);

            this._musicControls.add_child(this._previousButton);
            this._musicControls.add_child(this._playPauseButton);
            this._musicControls.add_child(this._nextButton);

            this._previousButton.set_child(this.previousIcon);
            this._playPauseButton.set_child(this.playIcon);
            this._nextButton.set_child(this.nextIcon);

            this._playPauseButton.connect("clicked", () => {
                if (this._player) {
                this._player.toggleStatus();
                }
            });

            this._nextButton.connect("clicked", () => {
                if (this._player) {
                this._player.goNext();
                }
            });

            this.add_child(this._musicAlbumArt);
            this.add_child(this._musicMetadata);
            this.add_child(this._musicControls);
            this._musicAlbumArt.set_child(this._musicAlbumArtFallback);
        }

        updateUI(metadata, status) {
            // Force conversion to string to prevent [object variant] labels
            this._musicTitle.set_text(String(metadata.title || "Unknown Title"));
            this._musicArtist.set_text(String(metadata.artist || "Unknown Artist"));

            if (metadata.artUrl) {
                this._loadAlbumArt(metadata.artUrl);
            } else {
                // Show fallback icon if no art URL
                this._musicAlbumArt.set_style(null);
                this._musicAlbumArt.set_child(this._musicAlbumArtFallback);
            }

            if (status === 'Playing') {
                this._playPauseButton.set_child(this.pauseIcon);
            } else {
                this._playPauseButton.set_child(this.playIcon);
            }
        }

        _loadAlbumArt(artUrl) {
            try {
                let file;
                
                if (artUrl.startsWith('file://')) {
                    file = Gio.File.new_for_uri(artUrl);
                } else if (artUrl.startsWith('http://') || artUrl.startsWith('https://')) {
                    file = Gio.File.new_for_uri(artUrl);
                } else {
                    file = Gio.File.new_for_path(artUrl);
                }

                // 1. Get average color and apply it to the main widget background
                const bgColor = this._getAverageColor(file);
                this.set_style(`background-color: ${bgColor};`);

                // 2. Clear any existing children (like the fallback icon) 
                // This ensures nothing "square" is sitting on top of your rounded corners.
                this._musicAlbumArt.set_child(null);

                // 3. Set the image as a background on the 'media-album-art' Bin.
                // GNOME Shell will correctly clip this background to the border-radius.
                this._musicAlbumArt.set_style(`
                    background-image: url("${file.get_uri()}");
                    background-size: cover;
                    background-position: center;
                    border-radius: 999px;
                    border: 1px solid transparent;
                `);

            } catch (e) {
                logError(e, 'Failed to load album art');
                this._musicAlbumArt.set_style(null);
                this._musicAlbumArt.set_child(this._musicAlbumArtFallback);
            }
        }

        _getAverageColor(file) {
            try {
                const inputStream = file.read(null);
                const pixbuf = GdkPixbuf.Pixbuf.new_from_stream(inputStream, null);
                
                // Scale to 1x1 to average all pixels
                const smallPixbuf = pixbuf.scale_simple(1, 1, GdkPixbuf.InterpType.BILINEAR);
                const pixels = smallPixbuf.get_pixels();
                
                // pixels is a Uint8Array [R, G, B, (A)]
                return `rgb(${pixels[0]}, ${pixels[1]}, ${pixels[2]})`;
            } catch (e) {
                logError(e, 'Failed to extract color');
                return 'rgba(30, 30, 30, 0.9)'; // Fallback color
            }
        }
    }
)