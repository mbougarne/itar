# Native scenario checklist — all NOT RUN

These describe intended test actions and expectations, not observed results.
Record exact package hash, runtime/device/remote/reader, actual outcome and any
minimal reproduction when a native test window becomes available.

1. Home → move between navigation, hero and each rail. Navigate horizontally
   beyond the first visible cards, then vertically into poster rows. Confirm
   visible native focus, clipping, labels and native scroll reveal. This mounted
   ScrollView composition's reveal/geometry behavior is an open integration risk.
2. Reach the bottom or final row's last two titles. Expect one simulated fetch,
   four appended rows and stable existing identities. Rapid repeats must not
   duplicate rows. Reach the new end; verify explicit exhaustion and Reload.
3. Select a title far down/across a rail → details → select cast biographies →
   Back. Compare the actual returned target and both scroll offsets with the
   opener. Verify no inactive catalogue targets or text remain reader-visible.
4. Open the featured title and its rail copy separately. Confirm each returns
   to its own occurrence, despite identical content identity.
5. Movies shows only movies; Series shows only series. Switch screens repeatedly;
   recreated routes enter navigation, rather than claiming native history restore.
6. Search ATLAS, delete, clear, enter a no-match query, and search MYSTERY.
   Navigate keyboard rows and results; change query while loading, leave Search
   and return. Verify no late page contaminates a new query or disposed route.
7. Select Stargazer in Profile. Confirm displayed identity and remounted route/
   cleared Search on return. Session-only settings and profiles are not persistence.
8. Settings → slow requests → arm failure → Movies. Expect error and Retry;
   retries recover. Next, scroll for pagination and inspect stable focus during
   loading, append and exhaustion. Gold/white accents should remain perceivable.
9. Remote Back from details returns to its active origin; from another main
   screen goes Home; from Home passes to the host. Reader activation and input
   activation remain separate; validate TalkBack/VoiceView/VoiceOver as available.
10. Check 720p/1080p/4K layout, long native labels, artwork/text legibility,
    contrast, focus boundaries and reduced-motion/system settings on actual TVs.

No video/player, network provider, public virtualized collection, reader support
or native scrolling/focus acceptance is established by the source tests.

11. Development Settings → original probes → Cinema. Verify the original probes
    remain usable and returning creates a fresh OTT provider. Release Settings
    must not expose probe mode. Native registration stays `ItarProbe`.
