/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import GObject from "gi://GObject";
import St from "gi://St";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { MediaWidget } from "./core/classes/MediaWidget.js";
import Clutter from 'gi://Clutter';
import { MediaWatcher } from "./core/classes/MediaWatcher.js";


const DashContainer = GObject.registerClass(
    class DashContainer extends St.BoxLayout {
        _init() {
            super._init({
                style_class: "dash-media-player",
                vertical: true,
                x_expand: true,
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this.mediaPlayerWidget = new MediaWidget();
            this.add_child(this.mediaPlayerWidget);
        }
    }
)

export default class DockMediaPlayerExtension extends Extension 
{
    enable()
    {
        this.dashContainer = new DashContainer();
        this._isVisible = false;
        this._currentStatus = 'expanded';
        this._mediaWatcher = new MediaWatcher((busName, newStatus, trackInfo) => {
            this.onMediaStatusChange(busName, newStatus, trackInfo);
        });
        this._mediaWatcher.watchPlayers();
        

        const existingDash = Main.uiGroup.get_children().find(
            actor => actor.get_name() === 'dashtodockContainer' && actor.constructor.name === 'DashToDock'
        );

        if (existingDash)
        {
            this.attachMediaWidget(existingDash);
        }
        else
        {
            let id = Main.uiGroup.connect('child-added', (_, actor) => {
                if ((actor.get_name() === 'dashtodockContainer') && (actor.constructor.name === 'DashToDock'))
                {
                    Main.uiGroup.disconnect(id);
                    this.attachMediaWidget(actor);
                }
            });
        }
    }

    disable()
    {
        this.collapseDashMediaContainer(() => {
                if (this.dashContainer.get_parent()) {
                    this.dashContainer.get_parent().remove_child(this.dashContainer);
                }
                this.dashContainer = null;
        });

        this._mediaWatcher.destroy();
        this._mediaWatcher = null;
    }

    onMediaStatusChange(busName, newStatus, trackInfo)
    {
        if (newStatus === 'Playing' || newStatus === 'Paused')
        {
            if (this._currentStatus !== 'expanded')
                this.expandDashMediaContainer();

            if (this.dashContainer && this.dashContainer.mediaPlayerWidget)
            {
                this.dashContainer.mediaPlayerWidget.updateUI(trackInfo, newStatus);
            }
        }
        else
        {
            if (this._currentStatus !== 'collapsed')
            {
                this.collapseDashMediaContainer(() => {});
            }
        }

        Main.notify('Media Status Changed', `New status: ${newStatus}`);
    }

    attachMediaWidget(dashToDock)
    {
        this.dashToDockElement = dashToDock;

        const dash = dashToDock.dash;
        
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            let [minH, natH] =
                this.dashContainer.mediaPlayerWidget.get_preferred_height(-1);

            let artSize = Math.max(32, natH - 16);

            this.dashContainer.mediaPlayerWidget._musicAlbumArt.set_size(
                artSize,
                artSize
            );

            return GLib.SOURCE_REMOVE;
        });
        
        dash._box.add_child(this.dashContainer);
        this.collapseDashMediaContainer(() => {});
    }

    expandDashMediaContainer() {
        this._currentStatus = 'expanded';
        this.dashContainer.show();

        // 1. STOP any running animations immediately to prevent the "fight"
        this.dashContainer.remove_all_transitions();

        // 2. IMPORTANT: Give GJS a tiny moment to render the new text 
        // before we measure the width.
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            // 3. Measure natural width now that text is updated
            let [minWidth, naturalWidth] = this.dashContainer.get_first_child().get_preferred_width(-1);

            // 4. Set a safe range (Floor of 180px, Ceiling of 300px)
            let targetWidth = Math.min(Math.max(naturalWidth, 180), 300);

            this.dashContainer.ease({
                width: targetWidth,
                opacity: 255,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    collapseDashMediaContainer(callback) {
        this._currentStatus = 'collapsed';

        // 1. STOP any running animations
        this.dashContainer.remove_all_transitions();

        this.dashContainer.ease({
            width: 0,
            opacity: 0,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (this._currentStatus === 'collapsed') {
                    this.dashContainer.hide();
                    if (callback) callback();
                }
            },
        });
    }
}

