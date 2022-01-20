import { withPluginApi } from "discourse/lib/plugin-api";
import { bind } from "discourse-common/utils/decorators";
import { cancel, later } from "@ember/runloop";

export default {
  name: "post-height-detective",

  initialize() {
    withPluginApi("1.1.0", (api) => {
      api.modifyClass("component:scrolling-post-stream", {
        pluginId: "post-height-detective",

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

        @bind
        trackHeight(post) {
          const recordedHeights = this.recordedHeights || {};
          const postId = post.id.split("_")[1];
          const topicId = this.get("posts.posts.firstObject.topic.id");
          const postLink = `${window.location.protocol}//${window.location.hostname}/t/${topicId}/${postId}`;
          const renderedHeight = post
            .querySelector(".cooked")
            .getBoundingClientRect().height;
          const oldHeight = recordedHeights[postId];

          if (oldHeight && renderedHeight !== oldHeight) {
            // eslint-disable-next-line no-console
            console.error(
              `🕵 Height of ${postLink} has changed after initial render. Was ${oldHeight}, now ${renderedHeight}`
            );
            document
              .querySelector("body")
              .classList.add("suspicious-post-detected");
          }

          recordedHeights[postId] = renderedHeight;
          this.set("recordedHeights", recordedHeights);
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
