/* eslint-disable no-console */

import { next } from "@ember/runloop";
import { bind } from "discourse/lib/decorators";
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "post-height-detective",

  initialize() {
    withPluginApi("1.1.0", (api) => {
      api.modifyClass("component:scrolling-post-stream", {
        pluginId: "post-height-detective",

        init() {
          this._super(...arguments);
          this.recordedHeights = new WeakMap();
          this.recordedHtml = new WeakMap();
          this.resizeObserver = new ResizeObserver(this.resizeObserverCallback);
        },

        afterRender() {
          // Do this super quick whenever rerendering happens,
          // otherwise we might miss something
          this.trackElements();
        },

        trackElements() {
          this.element
            .querySelectorAll("article[data-post-id]")
            .forEach((e) => this.resizeObserver.observe(e));
        },

        @bind
        resizeObserverCallback(resizeObserverEntries) {
          if (this.isDestroying || this.isDestroyed) {
            return;
          }

          for (const entry of resizeObserverEntries) {
            this.trackHeight(entry.target);
          }
        },

        trackHeight(post) {
          const postNumber = post.id.split("_")[1];
          const topicId = this.get("posts.posts.firstObject.topic.id");
          const postLink = `${window.location.protocol}//${window.location.hostname}/t/${topicId}/${postNumber}`;
          const postElement = post.querySelector(".cooked");

          if (!postElement) {
            return;
          }

          const renderedHeight = postElement.getBoundingClientRect().height;
          const oldHeight = this.recordedHeights.get(post);

          if (oldHeight && renderedHeight !== oldHeight) {
            console.error(
              `🕵 Height of ${postLink} has changed after initial render. Was ${oldHeight}, now ${renderedHeight}`
            );

            const recordedHtml = this.recordedHtml.get(post);
            if (recordedHtml === postElement.outerHTML) {
              console.log("No HTML change, check CSS");
            } else {
              console.log(
                `Previous HTML:\n\n${recordedHtml}\n\nCurrent HTML:\n\n${postElement.outerHTML}`
              );
            }

            next(() => document.body.classList.add("suspicious-post-detected"));
          }

          this.recordedHeights.set(post, renderedHeight);
          this.recordedHtml.set(post, postElement.outerHTML);
        },
      });

      api.onPageChange(() => {
        document.body.classList.remove("suspicious-post-detected");
      });
    });
  },
};
