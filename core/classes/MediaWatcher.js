import Gio from 'gi://Gio';
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { MediaWatcherStatus } from './MediaWatcherStatus.js';

// Interface for the Player properties
const mprisInterface = `
<node>
    <interface name="org.mpris.MediaPlayer2.Player">
        <property name="PlaybackStatus" type="s" access="read"/>
    </interface>
</node>`;

// Interface for the D-Bus service itself
const dBusInterface = `
<node>
    <interface name="org.freedesktop.DBus">
        <method name="ListNames">
            <arg direction="out" type="as"/>
        </method>
        <signal name="NameOwnerChanged">
            <arg direction="out" type="s"/>
            <arg direction="out" type="s"/>
            <arg direction="out" type="s"/>
        </signal>
    </interface>
</node>`;

const PlayerProxy = Gio.DBusProxy.makeProxyWrapper(mprisInterface);
const DBusProxy = Gio.DBusProxy.makeProxyWrapper(dBusInterface);

export const MediaWatcher = class MediaWatcher {
    constructor(callback) {
        this._players = new Map();
        this._dBusProxy = null;
        this._onStatusChange = callback;
        this._status = MediaWatcherStatus.STOPPED;
    }

    watchPlayers() {
        // Initialize the D-Bus proxy to monitor the session bus
        this._dBusProxy = new DBusProxy(
            Gio.DBus.session,
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus"
        );

        // 1. INITIAL SCAN: Find players already running (Based on player.js logic)
        // This ensures players started before the extension are detected
        const [names] = this._dBusProxy.ListNamesSync();
        names.forEach(name => {
            if (name.startsWith("org.mpris.MediaPlayer2")) {
                this.setupPlayerProxy(name);
            }
        });

        // 2. LISTEN FOR CHANGES: New players appearing or closing
        this._dBusProxy.connectSignal("NameOwnerChanged", (proxy, sender, [name, oldOwner, newOwner]) => {
            if (name.startsWith("org.mpris.MediaPlayer2")) {
                if (newOwner && !oldOwner) {
                    this.setupPlayerProxy(name);
                } else if (!newOwner && oldOwner) {
                    this._players.delete(name);
                    //Main.notify('Dock Media Player', 'Media Player Disconnected');
                }
            }
        });
    }

    setupPlayerProxy(busName) {
        if (this._players.has(busName)) return;

        const proxy = new PlayerProxy(
            Gio.DBus.session,
            busName,
            '/org/mpris/MediaPlayer2'
        );

        // Track playback status changes (Play/Pause/Stop)
        proxy.connect('g-properties-changed', (p) => {
            const status = p.PlaybackStatus;
            this._handleStatusChange(busName, status);
        });

        // Initial check for current status
        this._handleStatusChange(busName, proxy.PlaybackStatus);

        this._players.set(busName, proxy);
    }

    _handleStatusChange(busName, status) {
        //Main.notify('Dock Media Player', `Status Change Detected: ${status}`);
        // if (status === 'Playing') {
        //     Main.notify('Dock Media Player', `Playing: ${busName}`);
        // } else if (status === 'Paused' || status === 'Stopped') {
        //     Main.notify('Dock Media Player', `Stopped: ${busName}`);
        // }

        if (typeof this._onStatusChange === 'function')
        {
            this._onStatusChange(busName, status);
        }

        this._status = status;
    }

    destroy()
    {
        this._players.clear();
        this._onStatusChange = null;
        this._dBusProxy = null;
    }
};