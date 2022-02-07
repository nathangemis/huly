//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { Class, Doc, getCurrentAccount, Ref, Timestamp } from '@anticrm/core'
import notification, { LastView } from '@anticrm/notification'
import { createQuery, getClient } from '@anticrm/presentation'
import { writable, Writable } from 'svelte/store'

/**
 * @public
 */
export class NotificationClient {
  protected static _instance: NotificationClient | undefined = undefined
  private readonly lastViews = new Map<Ref<Doc>, LastView>()
  private readonly lastViewsStore = writable(new Map<Ref<Doc>, Timestamp>())

  private readonly lastViewQuery = createQuery()

  private constructor () {
    this.lastViewQuery.query(notification.class.LastView, { user: getCurrentAccount()._id }, (result) => {
      const res: Map<Ref<Doc>, Timestamp> = new Map<Ref<Doc>, Timestamp>()
      result.forEach((p) => {
        res.set(p.attachedTo, p.lastView)
        this.lastViews.set(p.attachedTo, p)
      })
      this.lastViewsStore.set(res)
    })
  }

  static getClient (): NotificationClient {
    if (NotificationClient._instance === undefined) {
      NotificationClient._instance = new NotificationClient()
    }
    return NotificationClient._instance
  }

  getLastViews (): Writable<Map<Ref<Doc>, Timestamp>> {
    return this.lastViewsStore
  }

  async updateLastView (
    _id: Ref<Doc>,
    _class: Ref<Class<Doc>>,
    time?: Timestamp,
    force: boolean = false
  ): Promise<void> {
    const client = getClient()
    const user = getCurrentAccount()._id
    const lastView = time ?? new Date().getTime()
    const current = this.lastViews.get(_id)
    if (current !== undefined) {
      if (current.lastView < lastView || force) {
        await client.updateDoc(current._class, current.space, current._id, {
          lastView: lastView
        })
      }
    } else if (force) {
      await client.createDoc(notification.class.LastView, notification.space.Notifications, {
        user,
        lastView,
        attachedTo: _id,
        attachedToClass: _class,
        collection: 'lastViews'
      })
    }
  }

  async unsubscribe (_id: Ref<Doc>): Promise<void> {
    const client = getClient()
    const user = getCurrentAccount()._id
    const current = await client.findOne(notification.class.LastView, { attachedTo: _id, user })
    if (current !== undefined) {
      await client.removeDoc(current._class, current.space, current._id)
    }
  }
}
