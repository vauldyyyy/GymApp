# FORMA image assets

## Training hero

- Project asset: `assets/images/training-hero.png`
- Dimensions: 1536 × 1024 pixels (landscape 3:2).
- Creation date: 2026-09-12.
- Tool: built-in `image_gen.imagegen`, default mode; no external reference images.
- Original: `C:\Users\vauld\.codex\generated_images\01a091d0-73e1-7641-8a0f-52caec496580\exec-90313983-ef7f-4b12-8021-a477cb12cea6.png`.
- Review: generated output inspected visually. Single adult athlete, grounded kettlebell stance, dark left negative space, directional window light, natural texture, no visible text, logo, or watermark.

### Final prompt

```text
Use case: photorealistic-natural
Asset type: premium fitness native app campaign hero photograph.
Primary request: A fit athletic adult woman in understated black training clothes, hair tied, preparing to lift a kettlebell in a modern dark concrete gym with daylight.
Style/medium: Photorealistic editorial luxury sportswear campaign. Candid strength, natural anatomy and skin texture, not bodybuilding.
Composition/framing: Landscape 3:2 aspect ratio. Subject centered-right with generous dark room on the left for a future text overlay. Show an authentic grounded stance and the kettlebell near her hands.
Lighting/mood: Beautiful directional daylight from high windows, rich charcoal blacks, subtle warm analog grain. Restrained premium art direction.
Materials/textures: Concrete, softly worn black metal, matte black performance fabric.
Constraints: One adult subject. No text, no logo, no watermark. This is a real-looking campaign photo, not an app screenshot.
```

## Onboarding portrait

- Project asset: `assets/images/training-onboarding.png`.
- Dimensions: 1024 × 1536 pixels (portrait 2:3).
- Creation date: 2026-09-12.
- Tool: built-in `image_gen.imagegen`, edit mode with `referenced_image_paths`.
- Edit target: `assets/images/training-hero.png`; the original remains unchanged.
- Generated source: `C:\Users\vauld\.codex\generated_images\01a091d0-73e1-7641-8a0f-52caec496580\exec-c54e63ca-e033-4909-8d0b-292cb566ebd4.png`.
- Review: inspected the generated portrait. The same athlete's entire head, body, shoes, and kettlebell are visible, with substantial floor below and dark space to the left for onboarding copy. Window daylight and charcoal concrete gym styling are retained. No visible text, logo, or watermark.

### Final edit prompt

```text
Use case: identity-preserve
Asset type: portrait campaign photograph for the tall onboarding panel of FORMA, a premium native fitness app.
Input image: the attached landscape training-hero photograph is the edit target and identity/style reference.
Primary request: Reframe and extend this exact photo into a portrait 2:3 composition, ideally 1024 by 1536 pixels. Preserve the same adult athletic woman, her identity, tied hair, black training clothes, natural body proportions, kettlebell preparation stance, equipment, and the modern dark concrete gym. Preserve the beautiful directional window daylight, charcoal blacks, warm subtle grain, and editorial sportswear realism.
Composition: Place the woman centered, fully visible from above the entire head to below both shoes, with the complete kettlebell visible. Keep comfortable clear margins around every body part so her head and right side remain visible in a narrow portrait panel. Keep the subject slightly above the vertical center, with usable dark negative space along the lower-left and bottom for future onboarding copy. Extend the gym and floor naturally as needed; this is a reframe/outpaint, not a close-up crop.
Constraints: Change only framing and extend the surroundings as needed. Preserve the original athlete, clothing, pose, lighting, gym materials and overall visual identity. No added people, no text, no logo, no watermark. Deliver a portrait photograph, not an app mockup.
```
