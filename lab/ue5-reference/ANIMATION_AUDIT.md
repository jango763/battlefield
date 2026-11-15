# Аудит анимаций: исходный 65-костный Quaternius vs 90-костный UE5-референс

## Результат проверки источника

Проверенный референс: [duolahypercho/ar-rifle-demo](https://github.com/duolahypercho/ar-rifle-demo), коммит `a6734b81a0679647cf26a30f1a0f6807b8f3b4bc`.

**В референсе 90 костей, не 95.** Это явно указано в
`blender/ue5_rig/UE5_SKELETON.md`. Скелет состоит из:
- 1 root;
- 12 туловище/голова;
- 23 × 2 кости каждой руки, включая пальцы;
- 4 × 2 кости ног;
- 16 twist bones;
- 7 IK bones.

82 кости могут деформировать сетку, 8 (`root` + 7 IK) не имеют весов.
Пять дополнительных костей, чтобы получить число 95, референсом не предусмотрены.

## Как реально сделаны анимации

1. `blender/rifle_motion/rig.py` создаёт отдельный **управляющий риг** на основе размеров исходного персонажа. Имеются arm IK, hand targets, elbow pole, leg IK, knee pole, gun controller, грудной socket.
2. `blender/build_rifle_motion.py` генерирует циклы, направления движения, позы переноски, прицеливания, перезарядки и попаданий с параметрами конкретного тела.
3. `blender/rifle_motion/bake.py` снимает состояние rig и constraints **по кадрам, 30 FPS**, запекает локальные вращения 90 костей, twist и IK, движение root/pelvis и отдельный канал `Gun`, затем экспортирует GLB.
4. `src/motion.js` загружает и смешивает заранее записанные клипы; руки не полагаются только на базовую анимацию ходьбы.
5. `src/character.js` добавляет поверх locomotion анимаций двухкостный IK хвата, наложение прицеливания, удержание ног и реакции.
6. `src/rig.js` переводит старый управляющий 56-костный proxy skeleton в действительные 90 костей с учётом rest pose, осей, twist и IK.

## Почему наш предыдущий 65-костный прототип не эквивалентен

Наш `lab/rig-pose/app.js` запекает только **4 локальных вращения** (`upperarm_l/r` и `lowerarm_l/r`) в `Aim_Raise_65`. Он не создаёт authored shoulder/chest/wrist/finger pose, не компенсирует разницу rest pose и не закрепляет хват двумя ладонями за оружием.
Число костей само по себе этого не решает.

## Практическое следствие

Изолированный тест `lab/ue5-reference/index.html` загружает **оригинальную модель + оригинальные GLB клипы с одинаковым skeleton и rest pose** из источника. Это диагностический референс, **не наша 95-костная модель**. Присутствуют `rifle-idle`, `rifle-walk-f`, `rifle-jog-f`, `rifle-sprint`, `rifle-aim-level`, `rifle-hold-high`.

После подтверждённого воспроизведения исходного референса:
1. Отдельно выбрать целевой риг (рекомендуется существующий **90-костный**, а не создавать произвольные пять новых костей).
2. Перенести *скиннинг и веса* нашей модели на новый риг в Blender.
3. Для этого тела пересчитать joint positions, rest rotations, hand/shoulder/grip reference points.
4. Пересобрать клипы на целевом риге и экспортировать GLB с проверкой рук, локтей, плеч, шагов и переходов.
5. Встроить проверенный GLB в Babylon.js и только потом возвращать MP40.

## Источники
- `https://github.com/duolahypercho/ar-rifle-demo/blob/main/blender/ue5_rig/UE5_SKELETON.md`
- `https://github.com/duolahypercho/ar-rifle-demo/blob/main/blender/build_rifle_motion.py`
- `https://github.com/duolahypercho/ar-rifle-demo/blob/main/blender/rifle_motion/rig.py`
- `https://github.com/duolahypercho/ar-rifle-demo/blob/main/blender/rifle_motion/bake.py`
- `https://github.com/duolahypercho/ar-rifle-demo/blob/main/src/rig.js`
- `https://github.com/duolahypercho/ar-rifle-demo/blob/main/src/character.js`
- `https://github.com/duolahypercho/ar-rifle-demo/blob/main/src/motion.js`

**Проверки:** структурные различия подтверждены исходным кодом. Работу в iPhone Safari и успешную визуальную анимацию в нашем тестовом просмотрщике пока не подтверждали.
