/* eslint-disable no-console */

import { next } from "@ember/runloop";
import { apiInitializer } from "discourse/lib/api";

const recordedHeights = new WeakMap();
const recordedHtml = new WeakMap();
const resizeObserver = new ResizeObserver(resizeObserverCallback);
const mutationObserver = new MutationObserver((mutationList) => {
  for (const mutation of mutationList) {
    if (mutation.type === "childList") {
      for (const addedNode of mutation.addedNodes) {
        if (addedNode.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }
        if (addedNode.matches("article[data-post-id]")) {
          console.log("tracking new post", addedNode);
          trackHeight(addedNode);
        }
        const nestedPosts = addedNode.querySelectorAll("article[data-post-id]");
        for (const nestedPost of nestedPosts) {
          console.log("tracking nested post", nestedPost);
          resizeObserver.observe(nestedPost);
          trackHeight(nestedPost);
        }
      }
    }
  }
});
mutationObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

function resizeObserverCallback(resizeObserverEntries) {
  for (const entry of resizeObserverEntries) {
    trackHeight(entry.target);
  }
}

function trackHeight(post) {
  if (!document.body.contains(post)) {
    return;
  }
  const postNumber = post.id.split("_")[1];
  const topicId = post.closest("[data-topic-id]").dataset.topicId;
  const postLink = `${window.location.protocol}//${window.location.hostname}/t/${topicId}/${postNumber}`;
  const postElement = post.querySelector(".cooked");

  if (!postElement) {
    return;
  }

  const renderedHeight = postElement.getBoundingClientRect().height;
  const oldHeight = recordedHeights.get(post);

  if (oldHeight && renderedHeight !== oldHeight) {
    console.error(
      `🕵 Height of ${postLink} has changed after initial render. Was ${oldHeight}, now ${renderedHeight}`
    );

    const prevRecordedHtml = recordedHtml.get(post);
    if (prevRecordedHtml === postElement.outerHTML) {
      console.log("No HTML change, check CSS");
    } else {
      console.log(
        `Previous HTML:\n\n${prevRecordedHtml}\n\nCurrent HTML:\n\n${postElement.outerHTML}`
      );
    }

    next(() => document.body.classList.add("suspicious-post-detected"));
  }

  recordedHeights.set(post, renderedHeight);
  recordedHtml.set(post, postElement.outerHTML);
}

export default apiInitializer((api) => {
  api.onPageChange(() => {
    document.body.classList.remove("suspicious-post-detected");
  });
});
