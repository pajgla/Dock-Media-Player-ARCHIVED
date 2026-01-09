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

            // Main container for metadata and controls (right side)
            this._rightContainer = new St.BoxLayout({
                style_class: "media-right-container",
                vertical: true,
                x_expand: true,
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Title at the top (full width)
            this._musicTitle = new St.Label({
                style_class: "media-music-title",
                text: "Unknown Title",
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._musicTitle.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            this._musicTitle.clutter_text.min_width = 50;
            this._musicTitle.clutter_text.max_width = 50;

            // Bottom row: artist on left, controls on right
            this._bottomRow = new St.BoxLayout({
                style_class: "media-bottom-row",
                vertical: false,
                x_expand: true,
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Artist label (left half of bottom row)
            this._musicArtist = new St.Label({
                style_class: "media-music-artist",
                text: "Unknown Artist",
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });
            this._musicArtist.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            this._musicArtist.clutter_text.min_width = 50;
            this._musicArtist.clutter_text.max_width = 50;

            // Media controls (right half of bottom row)
            this._musicControls = new St.BoxLayout({
                style_class: "media-controls",
                vertical: false,
                x_expand: false,
                y_expand: false,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Control buttons
            this._previousButton = new St.Button({
                style_class: "music-previous-button",
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

            // Album art (left side)
            this._musicAlbumArt = new St.Bin({
                style_class: "media-album-art",
                y_align: Clutter.ActorAlign.CENTER,
                clip_to_allocation: true,
            });

            this._musicAlbumArtFallback = new St.Icon({
                style_class: "media-album-art-fallback",
                icon_name: "audio-x-generic-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Icons
            this.playIcon = new St.Icon({
                style_class: "media-play-icon",
                icon_name: "media-playback-start-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.pauseIcon = new St.Icon({
                style_class: "media-pause-icon",
                icon_name: "media-playback-pause-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.nextIcon = new St.Icon({
                style_class: "media-next-icon",
                icon_name: "media-skip-forward-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.previousIcon = new St.Icon({
                style_class: "media-previous-icon",
                icon_name: "media-skip-backward-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Assemble the layout
            // Bottom row: artist + controls
            this._bottomRow.add_child(this._musicArtist);
            this._bottomRow.add_child(this._musicControls);

            // Right container: title on top, bottom row below
            this._rightContainer.add_child(this._musicTitle);
            this._rightContainer.add_child(this._bottomRow);

            // Add buttons to controls
            this._musicControls.add_child(this._previousButton);
            this._musicControls.add_child(this._playPauseButton);
            this._musicControls.add_child(this._nextButton);

            // Set button icons
            this._previousButton.set_child(this.previousIcon);
            this._playPauseButton.set_child(this.playIcon);
            this._nextButton.set_child(this.nextIcon);

            // Connect button events
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

            this._previousButton.connect("clicked", () => {
                if (this._player) {
                    this._player.goPrevious();
                }
            });

            // Add main components: album art on left, right container on right
            this._musicAlbumArt.set_child(this._musicAlbumArtFallback);
            this.add_child(this._musicAlbumArt);
            this.add_child(this._rightContainer);
        }

        updateUI(metadata, status) {
            // Force conversion to string to prevent [object variant] labels
            this._musicTitle.set_text(String(metadata.title || "Unknown Title"));
            this._musicArtist.set_text(String(metadata.artist || "Unknown Artist"));

            if (metadata.artUrl) {
                this._loadAlbumArt(metadata.artUrl);
            } else {
                // Show fallback icon if no art URL
                this._musicAlbumArt.set_child(this._musicAlbumArtFallback);
            }

            if (status === 'Playing') {
                this._playPauseButton.set_child(this.pauseIcon);
            } else {
                this._playPauseButton.set_child(this.playIcon);
            }
        }

        async _loadAlbumArt(artUrl) {
            try {
                let file;
                if (artUrl.startsWith('file://') || artUrl.startsWith('http')) {
                    file = Gio.File.new_for_uri(artUrl);
                } else {
                    file = Gio.File.new_for_path(artUrl);
                }

                // 1. Open the file stream asynchronously
                const inputStream = await new Promise((resolve, reject) => {
                    file.read_async(GLib.PRIORITY_DEFAULT, null, (source, res) => {
                        try { resolve(source.read_finish(res)); } catch (e) { reject(e); }
                    });
                });

                // 2. Load the Pixbuf from the stream asynchronously
                const pixbuf = await new Promise((resolve, reject) => {
                    GdkPixbuf.Pixbuf.new_from_stream_async(inputStream, null, (source, res) => {
                        try { resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(res)); } catch (e) { reject(e); }
                    });
                });

                // 3. Process color and update UI
                const { r, g, b } = this._calculateAverageRGB(pixbuf);
                const isDark = this._isColorDark(r, g, b);
                
                // Update background and text color contrast
                this.set_style(`background-color: rgba(${r}, ${g}, ${b}, 0.9);`);
                const textColor = isDark ? 'white' : '#1a1a1a';
                const subTextColor = isDark ? '#cccccc' : '#444444';

                this._musicTitle.set_style(`color: ${textColor};`);
                this._musicArtist.set_style(`color: ${subTextColor};`);

                // Set the icon
                const fileIcon = new Gio.FileIcon({ file: file });
                this._musicAlbumArt.set_child(new St.Icon({
                    gicon: fileIcon,
                    y_align: Clutter.ActorAlign.CENTER,
                }));

            } catch (e) {
                logError(e, 'Failed to load album art async');
                this._resetToDefaultStyle();
            }
        }

        _calculateAverageRGB(pixbuf) {
            // Scale to 1x1 to get average color
            const small = pixbuf.scale_simple(1, 1, GdkPixbuf.InterpType.BILINEAR);
            const pixels = small.get_pixels();
            return { r: pixels[0], g: pixels[1], b: pixels[2] };
        }

        _isColorDark(r, g, b) {
            // Rec. 709 luma coefficients
            const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            return luma < 0.5; // Returns true if the color is "dark"
        }

        _resetToDefaultStyle() {
            this.set_style('background-color: rgba(30, 30, 30, 0.9);');
            this._musicTitle.set_style('color: white;');
            this._musicArtist.set_style('color: #cccccc;');
            this._musicAlbumArt.set_child(this._musicAlbumArtFallback);
        }

        _getAverageColor(file) {
            try {
                // Load the pixbuf directly from the file path/URI
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                    file.get_path(), 
                    1, 1, // Scale down to 1x1 immediately
                    false
                );
                
                const pixels = pixbuf.get_pixels();
                // In GJS, pixels is a Uint8Array. 
                // For a 1x1 image, indices 0, 1, and 2 are R, G, and B.
                const r = pixels[0];
                const g = pixels[1];
                const b = pixels[2];

                // Apply a slight transparency so it fits the GNOME Shell aesthetic
                return `rgba(${r}, ${g}, ${b}, 0.8)`; 
            } catch (e) {
                return 'rgba(30, 30, 30, 0.9)'; // Fallback
            }
        }
    }
)