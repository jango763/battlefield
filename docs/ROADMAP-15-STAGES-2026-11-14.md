# Серый наёмник: Линия фронта — 15 контрольных этапов

Обновлено: 2026-11-14. Репозиторий: `jango763/battlefield`.

## Базовое состояние
- Проверенная ссылка на коммит `main` при составлении плана: `4afc1933c3a385cdf3de849f82231d59b8c4e520`.
- В `main` уже опубликован rollout немецких солдат с LOD. Это технический факт, а не визуальная приёмка iPhone.
- Британский пилот находится в `feature/british-army-pilot-after-wehrmacht-20261114`, где есть собственные проверки и правки костюма.
- `main` по этой дорожной карте не изменять до проверки и согласования. Рабочая версия, механика RTS, управление, экономика и текущая логика отрядов остаются неизменными.
- Браузерная HTML/Three.js игра, никакого перехода на Unreal.

## 15 этапов
1. [x] **Сверка исходной версии.** Проверить репозиторий, базовый SHA `main`, изолированные ветки Германии и Британии, наличие отката. *Сверка GitHub выполнена; проверка игры на iPhone отдельно.*
2. [x] **Убрать скачок анимаций при загрузке.** Первый видимый кадр только после native-rig idle pose; прежняя и donor-модели скрыты до готовности, с безопасным резервом при ошибке или 10-секундном ограничении. JS и Chromium desktop/mobile прошли; iPhone Safari отдельно в этапе 14.
3. [x] **Немецкий герой отдельно от армии.** Герою добавлена отдельная мягкая полевая укладка (ранец, скатка, сумка карты, лямка, аккуратные наплечные детали) и отличающийся оливковый тон формы. Дополнительные объекты следуют за грудной костью, не переносятся рядовым или британской стороне. Chromium desktop/mobile проверки пройдены; визуальная приёмка человеком и Safari — отдельно.
4. [x] **Британский герой отдельно от армии.** Песочная форма, ремни и подсумки P37-style, небольшой ранец, скатка и фляга. Оснащение привязано к груди; немецкий комплект скрывается у британца. Desktop/mobile Chromium и тест переключения сторон пройдены. Реальный iPhone Safari и визуальная приёмка пользователем — отдельно.
5. [ ] **Головные уборы.** Немецкая тёмно-оливковая вязаная шапка с подворотом над глазами — согласованный вариант героя. Британский красный/бордовый берет для нужной роли; каски и полевые головные уборы для обычной пехоты. Никаких двух уборов одновременно.
6. [ ] **Различия немецких ролей.** Винтовочник, автоматчик, пулемётчик, инженер и капитан: уникальные узнаваемые сочетания формы, снаряжения и стойки; проверка спереди и сзади.
7. [ ] **Различия британских ролей.** Винтовочник, автоматчик, пулемётчик, инженер и капитан: другая палитра, уборы и снаряжение, без путаницы фракций.
8. [ ] **Кисти, плечи, скелет и двухручный хват.** Проверить левую кисть, направление ладоней, пальцы, локти, точки крепления и отсутствие «жонглирования» оружием при переходах.
9. [ ] **Оружие Второй мировой.** Винтовка, автомат, пулемёт и два противотанковых типа; отличия Германии/Британии, читаемые модели, реальные точки хвата. Любые сторонние ассеты — с проверкой лицензии.
10. [ ] **Естественная походка.** Исправить «дроидные» движения, опору стоп, поворот корпуса, смену скорости и стрельбу на ходу, не меняя перемещение отрядов.
11. [ ] **Немецкий отряд 3–4 бойца.** Проверить уже внедрённую в `main` армию: уникальные скелеты, различия бойцов, оружие, переходы, приказы, укрытие и отсутствие регрессий.
12. [ ] **Британский отряд 3–4 бойца.** Довести имеющийся пилот до тех же требований, отдельно проверить переключение стороны, затем подготовить безопасное внедрение.
13. [ ] **Боевой регрессионный тест.** Прицеливание, выстрелы, попадания, смерть, выбор оружия, ИИ, групповые приказы и здания — внешний вид меняется, правила боя нет.
14. [ ] **Оптимизация и iPhone Safari.** Контроль начальной загрузки, отсутствия чёрного экрана, освобождения LOD, загрузки GLB, FPS и памяти. Цель: 30+ FPS на согласованном iPhone в репрезентативном бою; без замены реальных замеров утверждениями из Chromium.
15. [ ] **Финальная визуальная приёмка и выпуск.** Ссылки на тестовую сборку, четыре ракурса, ходьба/бег/стрельба обеих армий, приёмка пользователем, затем только перенос одобренных изменений в `main`.

## Порядок работы
- Один небольшой этап = отдельный проверяемый результат и точка сохранения.
- Перед каждым изменением проверять, что в проекте уже реализовано: не переустанавливать готовые системы и не тащить ненужные внешние юниты.
- Для каждого этапа: JS-синтаксис, тест анимации/оружия/боевой логики, сравнение с базовой версией, визуальная проверка; для мобильных этапов — Safari на реальном устройстве.
- Не считать зелёный CI визуальным одобрением. Не публиковать недоделанные визуальные правки в `main`.

## Stage 2 verification (2026-11-14)
- Branch: `feature/roadmap-15-stages-20261114`; `main` не изменён.
- Test: `tools/infantry-v2/test-stage2-startup.cjs`; CI run [`43625581857`](https://github.com/jango763/battlefield/actions/runs/43625581857) — desktop Chromium и mobile Chromium.
- Достигнуто: в момент снятия завесы `P.germanPreview.nativeRig` существует, а donor-модель/временное оружие скрыты; начальная анимация `idle`, переход в `jog` не меняет `P.x`.
- Не путать mobile Chromium с нативным Safari. Визуальная приёмка на реальном iPhone впереди. В случае сетевой ошибки интро закрывается, не оставляя страницу заблокированной.

## Stage 3 verification (2026-11-14)
- Test branch: `feature/roadmap-15-stages-20261114`; `main` не тронут.
- CI: [run 43626290491](https://github.com/jango763/battlefield/actions/runs/43626290491) — успешно, Chromium desktop и mobile.
- Test: `tools/infantry-v2/test-stage3-german-hero.cjs`; проверяет уникальные детали героя, отдельную палитру, отсутствие копий на немецкой пехоте, скрытие на британской стороне, соответствие грудной кости, исходную боевую логику и хват оружия.
- Снимки: [Github Actions artifact](https://github.com/jango763/battlefield/actions/runs/43626290491/artifacts/14125254855). Это автоматические снимки, не визуальная оценка пользователя.
- Головной убор намеренно не изменён на этапе 3: вязаная оливковая шапка немецкого героя — этап 5 после согласования внешности; британец — этап 4.

## Stage 4 verification — British player hero (2026-11-14)
- Реализация в ветке `feature/stage4-british-hero-20261114`; основная `main` пока на этапе 3, не изменена этапом 4.
- Настольный и мобильный Chromium успешно проверены: [GitHub Actions run 43627065932](https://github.com/jango763/battlefield/actions/runs/43627065932).
- В новой ветке британский герой получает отличную от немецкого оливкового комплекта песочную ткань (цвет 0xb5a17d) и собственное снаряжение; обычный британец комплект героя не получает.
- Пройдено: первый кадр idle, плавный jog, привязка к груди, хват, не меняются HP/оружие/координаты, немецкая экипировка и берет правильно переключаются при смене фракции, и не остаётся второй каски.
- Крупный план: `?inspect=british-hero`; обычная игровая камера не менялась. [Скриншоты CI](https://github.com/jango763/battlefield/actions/runs/43627065932/artifacts/14126228017).
- Этап 5 оставлен отдельно: окончательные формы и посадка головных уборов согласуются до публикации в `main`.

## Stage 5 partial checkpoint — British beret V3 (2026-11-14)
- Причина пересборки: прежний берет был широкой розовой «таблеткой» над головой — подтверждено просмотром фронтального и 3/4 скриншотов тестовой сборки.
- Новая британская модель `airborne-soft-slouch-v3`: единая мягкая низкая тулья, ободок, небольшая складка и знак; наружный размер уменьшен примерно на 19% по ширине и 16% по глубине, цвет приглушён до бордового, ободок опущен к голове.
- Крепление следует относительному повороту Mixamo head bone, исходный наклон кости компенсирован; шапка скрывается на немецкой стороне и не дублирует каску.
- QA: [GitHub Actions run 43628430094](https://github.com/jango763/battlefield/actions/runs/43628430094) — проходит в desktop/mobile Chromium; скриншоты из прогона просмотрены, размер улучшился. Это не приёмка пользователем и не реальный iPhone Safari.
- Известный предел прежней модели: в длительном беге ошибка захвата кисти около 0.177 м, отдельный пункт 8 — **не считать решённым**.
- Этап 5 целиком остаётся открытым: согласовать британский берет визуально и закончить немецкую тёмно-оливковую вязаную шапку с подворотом. Не переносить непроверенное в `main`.

## British beret visual iteration (2026-11-14)
- User screenshot showed an oversized rigid-looking overhang and too-high exposed forehead. No approval for merging stage 5 into main yet.
- New preview: `airborne-soft-fitted-v5`, branch `feature/stage5-beret-fit-20261114`.
- Adjustments: narrower single-piece felt crown (local width 0.313 vs earlier ~0.380), less lateral projection, higher dome to clear scalp after earlier v4 clipping, close-fit band and head-delta animation.
- Chromium desktop/mobile: [run 43629296614](https://github.com/jango763/battlefield/actions/runs/43629296614) passed. Screenshot artifact: [stage5 beret inspection](https://github.com/jango763/battlefield/actions/runs/43629296614/artifacts/14126489386).
- Remaining: the British tunic appears too pale/near-white in actual screenshot; grip error under jogging is ~0.177 m and needs separate arm/weapon IK work in stage 8. Real iPhone Safari not yet validated.
- Status: awaiting visual approval, `main` unchanged. Do not mark whole stage 5 complete: German knitted cap also remains.

## Emergency visual hotfix: four hands (2026-11-14)
- Source screenshot showed extra hand geometry over British STEN and outward-twisted, unnatural wrists; work branched from unmerged stage-5 preview, `feature/hero-hands-dedup-20261114`.
- Removed obsolete baked `NativeQuaterniusSupportPalm` mesh generator entirely. The original Quaternius skinned mesh remains hidden, and the WW2 donor costume alone draws its own two gloves.
- Compared 6 STEN fore-end positions and 8 hand-roll calibrations with staged Chromium screenshots; adopted the intermediate actual fore-end contact and British hero only mirrored wrist X rotations (left +0.8, right -0.8 radians). No edits to projectile/rules/camera/squad logic.
- New `?inspect=hands` preview mode chooses British STEN and close-up camera without affecting normal gameplay camera.
- Automated test `tools/infantry-v2/test-stage6-hands.cjs` checks no spare hands, original source meshes hidden, left/right donor bone wrists, idle, aim, jog, sprint, rifle-to-STEN switch and zero gameplay state mutations.
- Verified desktop and mobile Chromium: [CI run 43631630343](https://github.com/jango763/battlefield/actions/runs/43631630343). This is *not* real iPhone Safari validation.
- The remaining fine finger sculpt/hand pose and arm ergonomics belong to the later arm/weapon stage; the screenshot still has low-poly fingers and the British tunic remains too pale. Keep `main` unchanged until user visual acceptance.
