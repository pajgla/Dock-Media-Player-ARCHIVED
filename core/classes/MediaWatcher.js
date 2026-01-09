import Gio from 'gi://Gio';
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { MediaWatcherStatus } from './MediaWatcherStatus.js';

// Interface for the Player properties
const mprisInterface = `
<node>
    <interface name="org.mpris.MediaPlayer2.Player">
        <method name="PlayPause"/>
        <method name="Next"/>
        <method name="Previous"/>
        <method name="Stop"/>
        <property name="PlaybackStatus" type="s" access="read"/>
        <property name="Metadata" type="a{sv}" access="read"/>
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
                    // 1. Notify the extension that this player is gone before deleting
                    // We use 'Stopped' to trigger your existing collapse logic
                    this._handleStatusChange(name, 'Stopped'); 

                    // 2. Now delete it from the map
                    this._players.delete(name);
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

        // Store it FIRST so the map lookup doesn't fail
        this._players.set(busName, proxy);

        proxy.connect('g-properties-changed', (p) => {
            this._handleStatusChange(busName, p.PlaybackStatus);
        });

        // Pass the proxy directly to avoid Map lookup race conditions
        this._handleStatusChange(busName, proxy.PlaybackStatus, proxy);
    }

    _handleStatusChange(busName, status, manualProxy = null) {
        const proxy = manualProxy || this._players.get(busName);
        if (!proxy) return;

        let trackInfo = {
            title: "Unknown Title",
            artist: "Unknown Artist",
            artUrl: null,
        };

        // Get the Metadata property variant
        const metadataVariant = proxy.get_cached_property('Metadata');

        if (metadataVariant) {
            // recursiveUnpack() converts ALL nested variants to native JS types
            const unpacked = metadataVariant.recursiveUnpack();
            
            // Now 'unpacked' is a standard JS object like: 
            // { 'xesam:title': 'Song Name', 'xesam:artist': ['Artist A', 'Artist B'] }
            
            if (unpacked['xesam:title']) {
                trackInfo.title = String(unpacked['xesam:title']);
            }

            if (unpacked['xesam:artist']) {
                const artist = unpacked['xesam:artist'];
                // Since xesam:artist is a List of Strings
                trackInfo.artist = Array.isArray(artist) ? artist.join(', ') : String(artist);
            }

            if (unpacked['mpris:artUrl']) {
                trackInfo.artUrl = String(unpacked['mpris:artUrl']);
            }
        }

        if (typeof this._onStatusChange === 'function') {
            this._onStatusChange(busName, status, trackInfo);
        }
    }

    getProxy(busName)
    {
        return this._players.get(busName);
    }

    toggleStatus(busName) {
        const proxy = this.getProxy(busName);
        if (proxy) {
            // Must match <method name="PlayPause"/> + "Remote"
            proxy.PlayPauseRemote((result, error) => {
                if (error) logError(error);
            });
        }
    }

    goNext(busName) {
        const proxy = this.getProxy(busName);
        if (proxy) {
            proxy.NextRemote((result, error) => {
                if (error) log(`[MediaWatcher] Next error: ${error.message}`);
            });
        }
    }

    goPrevious(busName) {
        const proxy = this.getProxy(busName);
        if (proxy) {
            proxy.PreviousRemote((result, error) => {
                if (error) log(`[MediaWatcher] Previous error: ${error.message}`);
            });
        }
    }

    destroy()
    {
        this._players.clear();
        this._onStatusChange = null;
        this._dBusProxy = null;
    }
};