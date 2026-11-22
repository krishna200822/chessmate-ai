# EEZYbotARM MK2 - Robot Arm Specification

**Project**: ChessMate AI  
**Selected Arm**: **EEZYbotARM MK2** by daGHIZmo (Thingiverse: [1454048](https://www.thingiverse.com/thing:1454048))  
**Local CAD Assets**: `assets/eezybotarm/`

---

## 1. Kinematic Architecture
- **Type**: Articulated robot arm with ABB IRB460 parallel linkage (1:7 scale).
- **Degrees of Freedom (DOF)**:
  - **Joint 1 (Base Yaw)**: Rotates base turntable on horizontal plane ($\theta_1 \in [-90^\circ, +90^\circ]$).
  - **Joint 2 (Shoulder Pitch)**: Drives lower main arm (`EBAmk2_002_mainarm.STL`, $\theta_2$).
  - **Joint 3 (Elbow Pitch)**: Drives upper arm (`EBAmk2_006_horarm__.STL`, $\theta_3$) via the parallel link mechanism (`link135` & `link147`), keeping the claw platform level to the chessboard.
  - **End-Effector (Claw Gripper)**: Dual-gear rack-and-pinion gripper (`claw_finger_dx` + `claw_finger_sx`).

## 2. Link Dimensions
- Base Height ($L_0$): ~75 mm
- Main Lower Arm ($L_1$): 135 mm (between pivot centers)
- Upper Horizontal Arm ($L_2$): 147 mm (between pivot centers)
- End-Effector / Gripper Offset ($L_3$): ~60 mm to center of fingertips

## 3. Actuators (Hardware Mapping)
- **Servo 1 (Base)**: Standard size (MG995 / MG946 / DS3218)
- **Servo 2 (Shoulder)**: Standard size (MG995 / MG946)
- **Servo 3 (Elbow)**: Standard size (MG995 / MG946)
- **Servo 4 (Gripper)**: Micro size (SG90 / MG90S)

## 4. Software Implementation Plan
- **Phase 2 (Kinematics & Planning)**:
  - Analytical 2D planar + azimuth IK tailored to the $135\text{ mm} \times 147\text{ mm}$ parallel linkage.
  - Verification: IK error $< 1\text{ mm}$ for all 64 squares on standard board.
- **Phase 3 (Three.js 3D Visualization)**:
  - Load the exact `.STL` files from `assets/eezybotarm/` using Three.js `STLLoader`.
  - Assemble parts in hierarchical Three.js `Object3D` tree with exact rotational pivot points matching the CAD screws and bearings.
- **Phase 4 (Hardware Stub)**:
  - `HardwareArm` interface exposing angles $(\theta_1, \theta_2, \theta_3, \text{grip})$ for PCA9685 / Arduino / serial servo controllers.
