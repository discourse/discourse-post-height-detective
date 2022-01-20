import { withPluginApi } from "discourse/lib/plugin-api";
import { bind } from "discourse-common/utils/decorators";

export default {
  name: "post-height-detective",

  initialize(container) {
    withPluginApi("1.1.0", (api) => {
      api.modifyClass("component:scrolling-post-stream", {
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

        tick: function () {
          var nextTick = Ember.run.later(
            this,
            function () {
              this.checkForHeightChanges();
              this.tick();
            },
            1000
          );
          this.set("nextTick", nextTick);
        },

        didInsertElement: function () {
          this._super();
          this.tick();
        },

        willDestroyElement: function () {
          this._super();
          var nextTick = this.get("nextTick");
          Ember.run.cancel(nextTick);
        },

        @bind
        trackHeight(post) {
          const recordedHeights = this.get("recordedHeights") || {};
          const postId = post.id.split("_")[1];
          const topicId = this.get("posts.posts.firstObject.topic.id");
          const postLink = `${window.location.protocol}//${window.location.hostname}/t/${topicId}/${postId}`;
          const renderedHeight = post
            .querySelector(".cooked")
            .getBoundingClientRect().height;
          const oldHeight = recordedHeights[postId];
          if (oldHeight && renderedHeight !== oldHeight) {
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
