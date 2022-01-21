/* eslint-disable no-console */

import { withPluginApi } from "discourse/lib/plugin-api";
import { bind } from "discourse-common/utils/decorators";
import { cancel, later } from "@ember/runloop";

export default {
  name: "post-height-detective",

  initialize() {
    withPluginApi("1.1.0", (api) => {
      api.modifyClass("component:scrolling-post-stream", {
        pluginId: "post-height-detective",

        init() {
          this._super(...arguments);
          this.recordedHeights = {};
          this.recordedHtml = {};
        },

        afterRender() {
          // Do this super quick whenever rerendering happens,
          // otherwise we might miss something
          this.checkForHeightChanges();
        },

        checkForHeightChanges() {
          this.element
            .querySelectorAll("article[data-post-id]")
            .forEach(this.trackHeight);
        },

        tick() {
          const nextTick = later(
            this,
            () => {
              this.checkForHeightChanges();
              this.tick();
            },
            1000
          );
          this.set("nextTick", nextTick);
        },

        didInsertElement() {
          this._super(...arguments);
          this.tick();
        },

        willDestroyElement() {
          this._super(...arguments);
          const nextTick = this.nextTick;
          cancel(nextTick);
        },

        _refresh() {
          this._super(...arguments);
          this.recordedHeights = {};
          this.recordedHtml = {};
        },

        @bind
        trackHeight(post) {
          const postId = post.id.split("_")[1];
          const topicId = this.get("posts.posts.firstObject.topic.id");
          const postLink = `${window.location.protocol}//${window.location.hostname}/t/${topicId}/${postId}`;
          const postElement = post.querySelector(".cooked");
          const renderedHeight = postElement.getBoundingClientRect().height;
          const oldHeight = this.recordedHeights[postId];

          if (oldHeight && renderedHeight !== oldHeight) {
            console.error(
              `🕵 Height of ${postLink} has changed after initial render. Was ${oldHeight}, now ${renderedHeight}`
            );

            if (this.recordedHtml[postId] === postElement.outerHTML) {
              console.log("No HTML change, check CSS");
            } else {
              console.log(
                `Previous HTML:\n\n${this.recordedHtml[postId]}\n\nCurrent HTML:\n\n${postElement.outerHTML}`
              );
            }

            document
              .querySelector("body")
              .classList.add("suspicious-post-detected");
          }

          this.recordedHeights[postId] = renderedHeight;
          this.recordedHtml[postId] = postElement.outerHTML;
        },
      });

      api.onPageChange(() => {
        document
          .querySelector("body")
          .classList.remove("suspicious-post-detected");
      });
    });
  },
};
