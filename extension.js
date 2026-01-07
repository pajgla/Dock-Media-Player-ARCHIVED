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
import { MediaMonitor } from "./core/classes/MediaMonitor.js";
import Clutter from 'gi://Clutter';

const DashContainer = GObject.registerClass(
    class DashContainer extends St.BoxLayout {
        _init() {
            super._init({
                style_class: "dash-media-player",
                vertical: true,
                x_expand: true,
                y_expand: true,
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
        if (this.dashToDockElement)
        {
            //this.dashToDockElement.dash._box.remove_child(this.dashContainer);
            //this.dashToDockElement = null;

            this.dashContainer.ease({
                width: 0,
                opacity: 0,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    if (this.dashContainer.get_parent()) {
                        this.dashContainer.get_parent().remove_child(this.dashContainer);
                    }
                    this.dashContainer = null;
                }
            });
        }
    }

    attachMediaWidget(dashToDock)
    {
        this.dashToDockElement = dashToDock;

        const dash = dashToDock.dash;
        dash._box.add_child(this.dashContainer);

        const [minWidth, naturalWidth] = this.dashContainer.get_preferred_width(-1);

        this.dashContainer.set_width(0);
        this.dashContainer.set_opacity(0);

    // Use GLib.idle_add to ensure the widget is fully laid out
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.dashContainer.ease({
                width: naturalWidth,
                opacity: 255,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
            return GLib.SOURCE_REMOVE;
        });
    }
}

