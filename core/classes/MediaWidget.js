import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";

export const MediaWidget = GObject.registerClass(
    class MediaWidget extends St.BoxLayout
    {
        _init()
        {
            super._init({
                style_class: "media-player-widget",
                vertical: false,
                x_expand: false,
                y_expand: true,
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
                style_class: "music-artist",
                text: "",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._musicTitle = new St.Label({
                style_class: "music-title",
                text: "",
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._musicAlbumArt = new St.Bin({
                style_class: "music-album-art",
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
                style_class: "music-previous-icon",
                icon_name: "media-skip-backward-symbolic",
                y_align: Clutter.ActorAlign.CENTER,
            })

            this._musicMetadata.add_child(this._musicTitle);
            this._musicMetadata.add_child(this._musicArtist);
            this._musicAlbumArt.set_child(this._musicAlbumArtFallback);

            this._musicControls.add_child(this._playPauseButton);
            this._musicControls.add_child(this._nextButton);
            this._musicControls.add_child(this._previousButton);

            this._playPauseButton.set_child(this.playIcon);
            this._nextButton.set_child(this.nextIcon);
            this._previousButton.set_child(this.previousIcon);

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
        }
    }
)