import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Parses a standard FEN string into an array of piece placement descriptors.
 */
function parseFenToBoard(fen) {
  const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const boardFen = (fen || defaultFen).trim().split(' ')[0];
  const ranks = boardFen.split('/');
  const pieces = [];

  for (let r = 0; r < 8; r++) {
    const rankStr = ranks[r] || '8';
    const rankIndex = 7 - r; // rank 8 (top of FEN) is rankIndex 7, rank 1 is rankIndex 0
    let fileIndex = 0;

    for (const char of rankStr) {
      if (char >= '1' && char <= '8') {
        fileIndex += parseInt(char, 10);
      } else {
        const isWhite = char === char.toUpperCase();
        const type = char.toLowerCase();
        const fileChar = String.fromCharCode(97 + fileIndex);
        const rankChar = String(rankIndex + 1);
        const sqName = `${fileChar}${rankChar}`;

        pieces.push({
          id: `${char}_${sqName}`,
          type,
          color: isWhite ? 'white' : 'black',
          file: fileIndex,
          rank: rankIndex,
          sqName,
        });
        fileIndex++;
      }
    }
  }
  return pieces;
}

/**
 * Creates distinct 3D geometry and mesh for each of the 6 chess piece types.
 */
function createChessPieceMesh(type, color) {
  const group = new THREE.Group();
  const isWhite = color === 'white';

  const bodyMat = isWhite
    ? new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.25,
        metalness: 0.15,
      })
    : new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.5,
      });

  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xe2b342 : 0x94a3b8,
    roughness: 0.25,
    metalness: 0.8,
  });

  // Base disc common to all pieces
  const baseRadius = type === 'k' || type === 'q' ? 0.011 : type === 'p' ? 0.0085 : 0.0095;
  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius * 0.85, baseRadius, 0.005, 18),
    bodyMat
  );
  baseMesh.position.y = 0.0025;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  if (type === 'p') {
    // PAWN: Tapered waist + spherical head
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.012, 16), bodyMat);
    body.position.y = 0.010;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.005, 16, 16), bodyMat);
    head.position.y = 0.018;
    head.castShadow = true;
    group.add(head);
  } else if (type === 'r') {
    // ROOK: Sturdy castle tower with crenellation rim
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0085, 0.015, 16), bodyMat);
    body.position.y = 0.012;
    body.castShadow = true;
    group.add(body);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.008, 0.006, 16), bodyMat);
    top.position.y = 0.021;
    top.castShadow = true;
    group.add(top);
  } else if (type === 'n') {
    // KNIGHT: Slanted equine neck + horse head & muzzle
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0085, 0.013, 16), bodyMat);
    neck.position.set(0, 0.011, -0.002);
    neck.rotation.x = 0.2;
    neck.castShadow = true;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.011, 0.014), bodyMat);
    head.position.set(0, 0.019, 0.004);
    head.rotation.x = 0.25;
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.007, 0.007), bodyMat);
    snout.position.set(0, 0.016, 0.010);
    snout.castShadow = true;
    group.add(snout);
  } else if (type === 'b') {
    // BISHOP: Slender stem + mitre ellipsoid + finial
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.016, 16), bodyMat);
    stem.position.y = 0.012;
    stem.castShadow = true;
    group.add(stem);

    const mitre = new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 16), bodyMat);
    mitre.scale.set(1, 1.3, 0.9);
    mitre.position.y = 0.022;
    mitre.castShadow = true;
    group.add(mitre);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.002, 12, 12), goldAccentMat);
    finial.position.y = 0.030;
    group.add(finial);
  } else if (type === 'q') {
    // QUEEN: Fluted gown + flared coronet + royal jewel
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0095, 0.020, 18), bodyMat);
    body.position.y = 0.014;
    body.castShadow = true;
    group.add(body);

    const coronet = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.0065, 0.006, 16), bodyMat);
    coronet.position.y = 0.026;
    coronet.castShadow = true;
    group.add(coronet);

    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 12, 12), goldAccentMat);
    jewel.position.y = 0.031;
    group.add(jewel);
  } else if (type === 'k') {
    // KING: Royal mantle + capital + cross finial
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.010, 0.022, 18), bodyMat);
    body.position.y = 0.015;
    body.castShadow = true;
    group.add(body);

    const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.007, 0.006, 16), bodyMat);
    capital.position.y = 0.028;
    capital.castShadow = true;
    group.add(capital);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.006, 0.002), goldAccentMat);
    crossV.position.y = 0.034;
    group.add(crossV);

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.0055, 0.002, 0.002), goldAccentMat);
    crossH.position.y = 0.035;
    group.add(crossH);
  }

  group.userData = { type, color };
  return group;
}

/**
 * 3D Simulated 6-DOF Robotic Arm Canvas with High-Contrast Grid & Dynamic 32-Piece FEN Rendering.
 */
export default function ArmCanvas({
  trajectoryWaypoints = [],
  stepStatus = null,
  activeStep = null,
  activeMove = null,
  move = null,
  fromSquare = null,
  toSquare = null,
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  armStatus = 'standby',
  onAnimationComplete = null,
}) {
  const mountRef = useRef(null);
  const [currentStepLabel, setCurrentStepLabel] = useState(
    stepStatus || (typeof activeStep === 'string' ? activeStep : activeStep?.step) || 'READY / HOMED'
  );
  const [jointTelemetry, setJointTelemetry] = useState([90, 104, -117, -77, 0, 0]);
  const [gripperTelemetry, setGripperTelemetry] = useState(false);
  const [viewPreset, setViewPreset] = useState('ISO');

  // Animation and scene refs
  const waypointsRef = useRef(trajectoryWaypoints);
  const animStartTimeRef = useRef(0);
  const animDurationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const cameraRef = useRef(null);
  const fenRef = useRef(fen);

  const resolveMove = (actMove, mv, fSq, tSq) => {
    const candidate = actMove || mv;
    if (candidate) {
      if (typeof candidate === 'string') {
        return { from: candidate.slice(0, 2), to: candidate.slice(2, 4) };
      }
      if (candidate.from && candidate.to) {
        return { from: candidate.from, to: candidate.to };
      }
    }
    if (fSq && tSq) {
      return { from: fSq, to: tSq };
    }
    return null;
  };

  const activeMoveRef = useRef(resolveMove(activeMove, move, fromSquare, toSquare));
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  // Piece management refs
  const piecesGroupRef = useRef(null);
  const piecesBySquareRef = useRef({});
  const grippedPieceRef = useRef(null);
  const carriedPieceTypeRef = useRef(null);
  const gripperMarkerRef = useRef(null);
  const capturedCountRef = useRef({ white: 0, black: 0 });

  // Keep latest FEN, activeMove, onAnimationComplete in refs
  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    activeMoveRef.current = resolveMove(activeMove, move, fromSquare, toSquare);
  }, [activeMove, move, fromSquare, toSquare]);

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    const lbl = stepStatus || (typeof activeStep === 'string' ? activeStep : activeStep?.step);
    if (lbl) setCurrentStepLabel(lbl);
  }, [stepStatus, activeStep]);

  const getWpTime = (w) => (w ? (w.time !== undefined ? w.time : (w.t !== undefined ? w.t : 0)) : 0);
  const getWpAngles = (w) => (w ? (w.joint_angles || w.angles || [90, 104, -117, -77, 0, 0]) : [90, 104, -117, -77, 0, 0]);
  const getWpStep = (w) => (w ? (w.step_name || w.step || '') : '');
  const getWpGrip = (w) => (w ? (w.gripper > 0.3 || w.gripper === true) : false);

  useEffect(() => {
    if (trajectoryWaypoints && trajectoryWaypoints.length > 0) {
      waypointsRef.current = trajectoryWaypoints;
      animStartTimeRef.current = performance.now();
      const lastWp = trajectoryWaypoints[trajectoryWaypoints.length - 1];
      const totalT = getWpTime(lastWp);
      animDurationRef.current = (totalT > 0 ? totalT : 3.0) * 1000;
      isPlayingRef.current = true;
    }
  }, [trajectoryWaypoints]);

  // Demo motion trigger (Standard backend degree angles)
  const triggerTestMove = () => {
    const waypoints = [
      { time: 0.0, joint_angles: [90.0, 104.4, -117.0, -77.4, 0.0, 0.0], gripper: 0.0, step_name: 'HOME POSITION' },
      { time: 0.8, joint_angles: [85.6, 79.3, -124.6, -44.8, 0.0, 0.0], gripper: 0.0, step_name: 'HOVER ABOVE E2' },
      { time: 1.5, joint_angles: [85.6, 64.5, -127.2, -27.3, 0.0, 0.0], gripper: 1.0, step_name: 'DESCEND & GRIP WHITE PAWN' },
      { time: 2.2, joint_angles: [85.6, 79.3, -124.6, -44.8, 1.0, 0.0], gripper: 1.0, step_name: 'LIFT PAWN (+50mm)' },
      { time: 3.2, joint_angles: [86.6, 66.6, -106.8, -49.8, 1.0, 0.0], gripper: 1.0, step_name: 'MOVE TRAJECTORY TO E4' },
      { time: 3.9, joint_angles: [86.6, 55.2, -109.0, -36.2, 0.0, 0.0], gripper: 0.0, step_name: 'DESCEND & RELEASE ON E4' },
      { time: 4.5, joint_angles: [86.6, 66.6, -106.8, -49.8, 0.0, 0.0], gripper: 0.0, step_name: 'RETRACT CLEARANCE' },
      { time: 5.2, joint_angles: [90.0, 104.4, -117.0, -77.4, 0.0, 0.0], gripper: 0.0, step_name: 'RETURN HOME' },
    ];
    activeMoveRef.current = { from: 'e2', to: 'e4', uci: 'e2e4' };
    waypointsRef.current = waypoints;
    animStartTimeRef.current = performance.now();
    animDurationRef.current = 5200;
    isPlayingRef.current = true;
  };

  // Camera presets
  const applyViewPreset = (preset) => {
    setViewPreset(preset);
    if (!cameraRef.current) return;
    if (preset === 'ISO') {
      cameraRef.current.position.set(0.48, 0.55, 0.52);
      cameraRef.current.lookAt(0, 0.12, 0.22);
    } else if (preset === 'TOP') {
      cameraRef.current.position.set(0, 0.75, 0.22);
      cameraRef.current.lookAt(0, 0, 0.22);
    } else if (preset === 'SIDE') {
      cameraRef.current.position.set(0.65, 0.28, 0.22);
      cameraRef.current.lookAt(0, 0.15, 0.22);
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f6f9);
    scene.fog = new THREE.FogExp2(0xf6f6f9, 0.45);

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 450;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 10);
    camera.position.set(0.48, 0.55, 0.52);
    camera.lookAt(0, 0.12, 0.22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. High-Contrast Table Grid & Base Plane (Studio Light Aesthetic)
    const tableGrid = new THREE.GridHelper(1.2, 24, 0x18181b, 0xd4d4d8);
    tableGrid.position.y = 0;
    scene.add(tableGrid);

    const subGrid = new THREE.GridHelper(1.2, 48, 0x94a3b8, 0xe4e4e7);
    subGrid.position.y = -0.001;
    scene.add(subGrid);

    // 3. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(0.6, 1.2, 0.5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xe2e8f0, 0.9);
    rimLight.position.set(-0.35, 0.45, -0.2);
    scene.add(rimLight);

    const softFill = new THREE.PointLight(0xffffff, 0.8, 1.5);
    softFill.position.set(0.35, 0.35, 0.4);
    scene.add(softFill);

    // 4. Chessboard with High-Definition Coordinate Grid (Calibrated to Backend 30mm/270mm)
    const boardGroup = new THREE.Group();
    const sqSize = 0.030; // 30mm squares (matches backend config SQUARE_SIZE = 30.0)
    const boardSize = 8 * sqSize; // 240mm total square width
    const boardThick = 0.016; // 16mm thick
    const boardCenterZ = 0.270; // 270mm forward from arm base (matches backend config BOARD_CENTER_Y = 270.0)

    // Board Bezel / Body
    const bezelGeo = new THREE.BoxGeometry(boardSize + 0.024, boardThick, boardSize + 0.024);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.35,
      metalness: 0.85,
    });
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, boardThick / 2, boardCenterZ);
    bezelMesh.receiveShadow = true;
    boardGroup.add(bezelMesh);

    // Board Surface Border Glow (Electric Lime outline)
    const borderEdges = new THREE.EdgesGeometry(bezelGeo);
    const borderLine = new THREE.LineSegments(borderEdges, new THREE.LineBasicMaterial({ color: 0xccff00, linewidth: 2 }));
    borderLine.position.copy(bezelMesh.position);
    boardGroup.add(borderLine);

    // Side Piece Trays (Graveyard / Capture Trays)
    const trayGeo = new THREE.BoxGeometry(0.05, 0.008, 0.24);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.6 });
    const trayWhite = new THREE.Mesh(trayGeo, trayMat);
    trayWhite.position.set(-0.170, 0.004, 0.250); // Matches SIDE_TRAY_WHITE = (-170, 250, 15)
    trayWhite.receiveShadow = true;
    boardGroup.add(trayWhite);

    const trayBlack = new THREE.Mesh(trayGeo, trayMat);
    trayBlack.position.set(0.170, 0.004, 0.250); // Matches SIDE_TRAY_BLACK = (170, 250, 15)
    trayBlack.receiveShadow = true;
    boardGroup.add(trayBlack);

    // 64 Squares + Individual Grid Lines
    const squareGeo = new THREE.BoxGeometry(sqSize * 0.96, 0.002, sqSize * 0.96);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const squareEdgesGeo = new THREE.EdgesGeometry(squareGeo);
    const squareEdgesMat = new THREE.LineBasicMaterial({ color: 0x52525b });

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 1;
        const sqMesh = new THREE.Mesh(squareGeo, isLight ? lightMat : darkMat);
        const x = (c - 3.5) * sqSize;
        const z = boardCenterZ + (r - 3.5) * sqSize;
        sqMesh.position.set(x, boardThick + 0.001, z);
        sqMesh.receiveShadow = true;
        boardGroup.add(sqMesh);

        // Highlight grid edges for each square
        const edge = new THREE.LineSegments(squareEdgesGeo, squareEdgesMat);
        edge.position.copy(sqMesh.position);
        boardGroup.add(edge);
      }
    }
    scene.add(boardGroup);

    // 5. Dynamic 32 Chess Pieces Group
    const piecesGroup = new THREE.Group();
    scene.add(piecesGroup);
    piecesGroupRef.current = piecesGroup;

    // Helper to sync pieces from FEN
    const syncBoardPieces = (fenString) => {
      const currentlyGripped = grippedPieceRef.current;

      piecesGroup.clear();
      piecesBySquareRef.current = {};

      const pieceList = parseFenToBoard(fenString);

      const activeCounts = {
        white: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
        black: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
      };

      for (const p of pieceList) {
        const pieceMesh = createChessPieceMesh(p.type, p.color);
        const x = (p.file - 3.5) * sqSize;
        const z = boardCenterZ + (p.rank - 3.5) * sqSize;
        const y = boardThick + 0.001;

        pieceMesh.position.set(x, y, z);
        pieceMesh.userData.sqName = p.sqName;
        pieceMesh.userData.pieceType = p.type;
        pieceMesh.userData.color = p.color;

        piecesGroup.add(pieceMesh);
        piecesBySquareRef.current[p.sqName] = pieceMesh;

        if (activeCounts[p.color] && activeCounts[p.color][p.type] !== undefined) {
          activeCounts[p.color][p.type]++;
        }
      }

      // Populate side trays with captured pieces
      const initialCounts = {
        white: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 },
        black: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 },
      };

      const trayOrder = ['q', 'r', 'b', 'n', 'p'];
      let whiteTraySlot = 0;
      let blackTraySlot = 0;

      for (const color of ['white', 'black']) {
        for (const type of trayOrder) {
          const missing = (initialCounts[color][type] || 0) - (activeCounts[color][type] || 0);
          for (let m = 0; m < missing; m++) {
            const pieceMesh = createChessPieceMesh(type, color);
            const isWhite = color === 'white';
            const trayX = isWhite ? -0.170 : 0.170;
            const slot = isWhite ? whiteTraySlot++ : blackTraySlot++;
            const trayZ = 0.130 + (slot % 8) * 0.024;
            pieceMesh.position.set(trayX, 0.008, trayZ);
            pieceMesh.userData.sqName = `tray_${color}_${slot}`;
            pieceMesh.userData.pieceType = type;
            pieceMesh.userData.color = color;
            pieceMesh.userData.isCaptured = true;
            piecesGroup.add(pieceMesh);
          }
        }
      }
      capturedCountRef.current = { white: whiteTraySlot, black: blackTraySlot };

      if (currentlyGripped && currentlyGripped.userData?.sqName) {
        const match = piecesBySquareRef.current[currentlyGripped.userData.sqName];
        if (match) grippedPieceRef.current = match;
      }
    };

    // Initial pieces sync
    syncBoardPieces(fenRef.current);

    // 6. Build the 6-DOF Industrial Robot Arm Hierarchy (Sleek Obsidian & Electric Lime)
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
    const linkMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.75, roughness: 0.3 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0xccff00, metalness: 0.9, roughness: 0.2, emissive: 0x334400 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const gripperMat = new THREE.MeshStandardMaterial({ color: 0xccff00, metalness: 0.85, roughness: 0.25 });

    // Base pedestal
    const pedestalGeo = new THREE.CylinderGeometry(0.065, 0.085, 0.03, 32);
    const pedestal = new THREE.Mesh(pedestalGeo, chassisMat);
    pedestal.position.set(0, 0.015, 0);
    pedestal.castShadow = true;
    scene.add(pedestal);

    // Joint 1: Base Yaw (Rotation around Y)
    const j1Group = new THREE.Group();
    j1Group.position.set(0, 0.03, 0);
    scene.add(j1Group);

    const baseTurntable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 32), chassisMat);
    baseTurntable.position.y = 0.02;
    j1Group.add(baseTurntable);

    // Joint 2: Shoulder Pitch (Rotation around X)
    const j2Group = new THREE.Group();
    j2Group.position.set(0, 0.04, 0);
    j1Group.add(j2Group);

    const shoulderJointMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 24), jointMat);
    shoulderJointMesh.rotation.z = Math.PI / 2;
    j2Group.add(shoulderJointMesh);

    // Link 2 (Upper Arm)
    const l2Length = 0.18;
    const l2Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, l2Length, 0.04), linkMat);
    l2Mesh.position.set(0, l2Length / 2, 0);
    l2Mesh.castShadow = true;
    j2Group.add(l2Mesh);

    // Joint 3: Elbow Pitch (Rotation around X)
    const j3Group = new THREE.Group();
    j3Group.position.set(0, l2Length, 0);
    j2Group.add(j3Group);

    const elbowJointMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 24), jointMat);
    elbowJointMesh.rotation.z = Math.PI / 2;
    j3Group.add(elbowJointMesh);

    // Link 3 (Forearm)
    const l3Length = 0.16;
    const l3Mesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, l3Length, 0.032), linkMat);
    l3Mesh.position.set(0, l3Length / 2, 0);
    l3Mesh.castShadow = true;
    j3Group.add(l3Mesh);

    // Joint 4: Wrist Pitch (Rotation around X)
    const j4Group = new THREE.Group();
    j4Group.position.set(0, l3Length, 0);
    j3Group.add(j4Group);

    const wristJointMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 24), jointMat);
    wristJointMesh.rotation.z = Math.PI / 2;
    j4Group.add(wristJointMesh);

    // Joint 5: Wrist Roll (Rotation around Y)
    const j5Group = new THREE.Group();
    j5Group.position.set(0, 0.035, 0);
    j4Group.add(j5Group);

    const rollMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 20), chromeMat);
    rollMesh.position.y = 0.015;
    j5Group.add(rollMesh);

    // Joint 6: Gripper Flange (Rotation around Z)
    const j6Group = new THREE.Group();
    j6Group.position.set(0, 0.03, 0);
    j5Group.add(j6Group);

    // Gripper Base & Two Parallel Jaw Fingers
    const gripperBase = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.01, 0.02), chassisMat);
    j6Group.add(gripperBase);

    const fingerGeo = new THREE.BoxGeometry(0.006, 0.03, 0.012);
    const leftFinger = new THREE.Mesh(fingerGeo, gripperMat);
    leftFinger.position.set(-0.014, 0.018, 0);
    j6Group.add(leftFinger);

    const rightFinger = new THREE.Mesh(fingerGeo, gripperMat);
    rightFinger.position.set(0.014, 0.018, 0);
    j6Group.add(rightFinger);

    // Invisible Tool Center Point Marker for Piece Pickup
    const gripperTipMarker = new THREE.Object3D();
    gripperTipMarker.position.set(0, 0.032, 0);
    j6Group.add(gripperTipMarker);
    gripperMarkerRef.current = gripperTipMarker;

    // Laser pointer guide beam (Electric Lime)
    const laserMat = new THREE.LineBasicMaterial({ color: 0xccff00, transparent: true, opacity: 0.8 });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.03, 0),
      new THREE.Vector3(0, 0.35, 0)
    ]);
    const laser = new THREE.Line(laserGeo, laserMat);
    j6Group.add(laser);

    // 7. Degree to Radian Transformation & Inverse Kinematics Mapping
    const degToRad = (deg) => (deg * Math.PI) / 180;

    const applyAngles = (angles) => {
      // Joint 1: Base azimuth
      // Backend theta1: 90 deg is forward along board center (+Z)
      const a0 = angles[0] !== undefined ? angles[0] : 90;
      const yawDeg = Math.abs(a0) > 45 ? -(a0 - 90) : -a0;
      j1Group.rotation.y = degToRad(yawDeg);

      // Joint 2: Shoulder pitch
      // Backend theta2: angle above horizontal (90 deg = vertical UP)
      // Three.js: Link 2 starts vertical UP; pitching forward towards board is (90 - theta2)
      const a1 = angles[1] !== undefined ? angles[1] : 104;
      const pitchDeg = a1 > 20 ? (90 - a1) : -a1;
      j2Group.rotation.x = degToRad(pitchDeg);

      // Joint 3: Elbow pitch
      // Backend theta3: relative bend (negative, e.g. -117 deg)
      // Three.js: bending down towards board is positive relative pitch
      const a2 = angles[2] !== undefined ? angles[2] : -117;
      const elbowDeg = a2 < 0 ? -a2 : a2;
      j3Group.rotation.x = degToRad(elbowDeg);

      // Joint 4: Wrist pitch
      const a3 = angles[3] !== undefined ? angles[3] : -77;
      j4Group.rotation.x = degToRad(a3);

      // Joint 5: Wrist roll
      const a4 = angles[4] !== undefined ? angles[4] : 0;
      j5Group.rotation.y = degToRad(a4);

      // Joint 6: Gripper roll
      const a5 = angles[5] !== undefined ? angles[5] : 0;
      j6Group.rotation.z = degToRad(a5);
    };

    // Set initial home posture
    applyAngles([90.0, 104.4, -117.0, -77.4, 0.0, 0.0]);

    // 8. Interactive Mouse Drag Orbit Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let sphericalTheta = Math.PI / 4;
    let sphericalPhi = Math.PI / 3.2;
    let sphericalRadius = 0.85;
    const targetLookAt = new THREE.Vector3(0, 0.12, 0.22);

    const updateCameraFromOrbit = () => {
      camera.position.x = targetLookAt.x + sphericalRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      camera.position.y = targetLookAt.y + sphericalRadius * Math.cos(sphericalPhi);
      camera.position.z = targetLookAt.z + sphericalRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
      camera.lookAt(targetLookAt);
    };

    const handleMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      sphericalTheta -= dx * 0.008;
      sphericalPhi = Math.max(0.1, Math.min(Math.PI / 2.05, sphericalPhi - dy * 0.008));
      updateCameraFromOrbit();
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      sphericalRadius = Math.max(0.35, Math.min(1.6, sphericalRadius + e.deltaY * 0.001));
      updateCameraFromOrbit();
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('wheel', handleWheel, { passive: false });

    // 9. Animation & Telemetry Loop
    let animationFrameId;
    let lastUiUpdate = 0;
    let lastRenderedFen = fenRef.current;
    const tipWorldPos = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Check if FEN changed externally while idle and not moving
      if (!isPlayingRef.current && !activeMoveRef.current && fenRef.current !== lastRenderedFen) {
        lastRenderedFen = fenRef.current;
        syncBoardPieces(lastRenderedFen);
      }

      // Interpolate current angles along the trajectory
      if (isPlayingRef.current && waypointsRef.current && waypointsRef.current.length > 0) {
        const waypoints = waypointsRef.current;
        const elapsedSec = (performance.now() - animStartTimeRef.current) / 1000;
        const totalSec = animDurationRef.current / 1000;

        let curAngles = [90, 104, -117, -77, 0, 0];
        let isGripActive = false;

        if (elapsedSec >= totalSec) {
          // Reached final waypoint
          const last = waypoints[waypoints.length - 1];
          if (last) {
            curAngles = getWpAngles(last);
            applyAngles(curAngles);
            const sName = getWpStep(last);
            if (sName) setCurrentStepLabel(sName);
            isGripActive = getWpGrip(last);
          }
          isPlayingRef.current = false;

          // Release and seat any remaining gripped piece precisely at the center of the target square
          if (grippedPieceRef.current) {
            const curMove = activeMoveRef.current;
            if (curMove && curMove.to && carriedPieceTypeRef.current !== 'victim') {
              const toFile = curMove.to.charCodeAt(0) - 97;
              const toRank = parseInt(curMove.to[1], 10) - 1;
              const destX = (toFile - 3.5) * sqSize;
              const destZ = boardCenterZ + (toRank - 3.5) * sqSize;
              grippedPieceRef.current.position.set(destX, boardThick + 0.001, destZ);
              piecesBySquareRef.current[curMove.to] = grippedPieceRef.current;
              if (curMove.from) {
                delete piecesBySquareRef.current[curMove.from];
              }
              grippedPieceRef.current.userData.sqName = curMove.to;
            } else if (carriedPieceTypeRef.current === 'victim') {
              const isWhiteVictim = grippedPieceRef.current.userData?.color === 'white';
              const traySide = isWhiteVictim ? 'white' : 'black';
              const slotIndex = capturedCountRef.current[traySide] || 0;
              const trayX = isWhiteVictim ? -0.170 : 0.170;
              const trayZ = 0.130 + (slotIndex % 8) * 0.024;
              grippedPieceRef.current.position.set(trayX, 0.008, trayZ);
              if (curMove && curMove.to && piecesBySquareRef.current[curMove.to] === grippedPieceRef.current) {
                delete piecesBySquareRef.current[curMove.to];
              }
              grippedPieceRef.current.userData.isCaptured = true;
            } else {
              grippedPieceRef.current.position.y = boardThick + 0.001;
            }
            grippedPieceRef.current.userData.isBeingCarried = false;
            grippedPieceRef.current = null;
            carriedPieceTypeRef.current = null;
          }

          // Notify parent component that arm animation finished
          if (onAnimationCompleteRef.current) {
            const cb = onAnimationCompleteRef.current;
            onAnimationCompleteRef.current = null;
            cb();
          }
        } else {
          // Find segment to interpolate
          let segIdx = 0;
          for (let i = 0; i < waypoints.length - 1; i++) {
            const t1 = getWpTime(waypoints[i]);
            const t2 = getWpTime(waypoints[i + 1]);
            if (elapsedSec >= t1 && elapsedSec <= t2) {
              segIdx = i;
              break;
            }
          }
          const p1 = waypoints[segIdx];
          const p2 = waypoints[Math.min(segIdx + 1, waypoints.length - 1)];

          const t1 = getWpTime(p1);
          const t2 = getWpTime(p2);
          const segDuration = Math.max(0.0001, t2 - t1);
          const alpha = Math.max(0, Math.min(1, (elapsedSec - t1) / segDuration));

          // Smooth cosine interpolation
          const smoothAlpha = 0.5 * (1 - Math.cos(alpha * Math.PI));

          const a1List = getWpAngles(p1);
          const a2List = getWpAngles(p2);
          for (let j = 0; j < 6; j++) {
            const a1Val = a1List[j] !== undefined ? a1List[j] : 0;
            const a2Val = a2List[j] !== undefined ? a2List[j] : 0;
            curAngles[j] = a1Val + (a2Val - a1Val) * smoothAlpha;
          }

          applyAngles(curAngles);
          isGripActive = getWpGrip(p1) || getWpGrip(p2);

          // Animate gripper jaw open / close
          const jawOffset = isGripActive ? 0.007 : 0.015;
          leftFinger.position.x = -jawOffset;
          rightFinger.position.x = jawOffset;

          // 10. Physical Pick-and-Place Transport: Latch to Exact Designated Piece
          gripperTipMarker.getWorldPosition(tipWorldPos);

          if (isGripActive) {
            // Latch strictly onto the exact piece designated for that square
            if (!grippedPieceRef.current && piecesGroup.children.length > 0) {
              const curMove = activeMoveRef.current;
              let targetPiece = null;

              if (curMove && curMove.from) {
                const curStepName = (
                  (p1 && getWpStep(p1)) ||
                  (p2 && getWpStep(p2)) ||
                  ''
                ).toLowerCase();

                // Physical distances from gripper tip to fromSquare and toSquare
                let distToSource = 999;
                let distToTarget = 999;

                if (curMove.from) {
                  const fromFile = curMove.from.charCodeAt(0) - 97;
                  const fromRank = parseInt(curMove.from[1], 10) - 1;
                  const fromX = (fromFile - 3.5) * sqSize;
                  const fromZ = boardCenterZ + (fromRank - 3.5) * sqSize;
                  distToSource = Math.hypot(tipWorldPos.x - fromX, tipWorldPos.z - fromZ);
                }

                if (curMove.to) {
                  const toFile = curMove.to.charCodeAt(0) - 97;
                  const toRank = parseInt(curMove.to[1], 10) - 1;
                  const toX = (toFile - 3.5) * sqSize;
                  const toZ = boardCenterZ + (toRank - 3.5) * sqSize;
                  distToTarget = Math.hypot(tipWorldPos.x - toX, tipWorldPos.z - toZ);
                }

                // Stage 1 Detection (Victim removal):
                // 1) Step name contains 'victim', 'capture', or 'tray'
                // 2) Arm is near destination square (< 45mm) AND a piece exists on toSquare
                // 3) Arm is closer to destination square than source square
                const hasVictimName =
                  curStepName.includes('victim') ||
                  curStepName.includes('capture') ||
                  curStepName.includes('tray');

                const isNearDestination = distToTarget < 0.045 && distToTarget < distToSource;
                const pieceAtTarget = curMove.to ? piecesBySquareRef.current[curMove.to] : null;

                const isVictimStage = (hasVictimName || isNearDestination) && Boolean(pieceAtTarget);

                if (isVictimStage && curMove.to && pieceAtTarget) {
                  // Stage 1: Grip victim piece standing on toSquare
                  targetPiece = pieceAtTarget;
                  carriedPieceTypeRef.current = 'victim';
                } else {
                  // Stage 2: Grip attacking piece on fromSquare
                  targetPiece =
                    piecesBySquareRef.current[curMove.from] ||
                    piecesGroup.children.find((c) => c.userData?.sqName === curMove.from && !c.userData?.isCaptured);
                  carriedPieceTypeRef.current = 'mover';
                }
              }

              if (targetPiece) {
                grippedPieceRef.current = targetPiece;
                grippedPieceRef.current.userData.isBeingCarried = true;
              }
            }

            // Carry that exact piece smoothly with the gripper in 3D air
            if (grippedPieceRef.current) {
              grippedPieceRef.current.position.set(
                tipWorldPos.x,
                Math.max(boardThick + 0.001, tipWorldPos.y - 0.016),
                tipWorldPos.z
              );
            }
          } else {
            // Gripper released: deposit piece precisely at the center of the 'to' square (or side capture tray)
            if (grippedPieceRef.current) {
              const curMove = activeMoveRef.current;
              const releasedPiece = grippedPieceRef.current;
              const curStepName = (
                (p1 && getWpStep(p1)) ||
                (p2 && getWpStep(p2)) ||
                ''
              ).toLowerCase();

              const isHeadingToTray =
                Math.abs(tipWorldPos.x) > 0.12 ||
                curStepName.includes('tray') ||
                curStepName.includes('victim');

              if (carriedPieceTypeRef.current === 'victim' || isHeadingToTray) {
                // Stage 1: Deposited permanently into side capture tray
                const isWhiteVictim = releasedPiece.userData?.color === 'white';
                const traySide = isWhiteVictim ? 'white' : 'black';
                const slotIndex = capturedCountRef.current[traySide] || 0;
                capturedCountRef.current[traySide] = slotIndex + 1;

                // Base tray coordinates:
                // White tray on Left (X = -0.170), Black tray on Right (X = +0.170)
                const trayX = isWhiteVictim ? -0.170 : 0.170;
                const trayZ = 0.130 + (slotIndex % 8) * 0.024;
                releasedPiece.position.set(trayX, 0.008, trayZ);
                releasedPiece.rotation.set(0, 0, 0);

                // Permanently park it and remove it from active 8x8 square mapping
                if (curMove && curMove.to && piecesBySquareRef.current[curMove.to] === releasedPiece) {
                  delete piecesBySquareRef.current[curMove.to];
                }
                releasedPiece.userData.sqName = `tray_${traySide}_${slotIndex}`;
                releasedPiece.userData.isCaptured = true;
              } else if (curMove && curMove.to) {
                // Stage 2: Release attacking piece precisely at the center of the 'to' square
                const toFile = curMove.to.charCodeAt(0) - 97;
                const toRank = parseInt(curMove.to[1], 10) - 1;
                const destX = (toFile - 3.5) * sqSize;
                const destZ = boardCenterZ + (toRank - 3.5) * sqSize;
                releasedPiece.position.set(destX, boardThick + 0.001, destZ);

                if (curMove.from && piecesBySquareRef.current[curMove.from] === releasedPiece) {
                  delete piecesBySquareRef.current[curMove.from];
                }
                piecesBySquareRef.current[curMove.to] = releasedPiece;
                releasedPiece.userData.sqName = curMove.to;
              } else {
                releasedPiece.position.y = boardThick + 0.001;
              }

              releasedPiece.userData.isBeingCarried = false;
              grippedPieceRef.current = null;
              carriedPieceTypeRef.current = null;
            }
          }

          // Throttle React state telemetry updates
          const now = performance.now();
          if (now - lastUiUpdate > 60) {
            lastUiUpdate = now;
            setJointTelemetry(curAngles.map((a) => Math.round(a)));
            setGripperTelemetry(isGripActive);
            const stepName = getWpStep(p1);
            if (stepName) setCurrentStepLabel(stepName);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize Handling
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('wheel', handleWheel);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative flex flex-col h-full bg-white/95 rounded-3xl border border-neutral-200/90 shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden backdrop-blur-md">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white border-b border-neutral-100">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse" />
          <h2 className="text-xs font-sans font-bold tracking-tight text-neutral-900 uppercase">
            6-DOF Kinematic Manipulator
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex bg-neutral-100 rounded-full p-0.5 text-[10px] font-sans">
            {['ISO', 'TOP', 'SIDE'].map((preset) => (
              <button
                key={preset}
                onClick={() => applyViewPreset(preset)}
                className={`px-2.5 py-0.5 rounded-full transition-all ${
                  viewPreset === preset ? 'bg-black text-white font-bold shadow-sm' : 'text-neutral-500 hover:text-black'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <button
            onClick={triggerTestMove}
            className="px-3 py-1 text-[10px] font-sans font-bold bg-[#ccff00] hover:bg-[#d9ff33] text-neutral-950 rounded-full transition-all shadow-sm"
            title="Click to see the simulated arm move e2 pawn to e4"
          >
            ▶ TEST ARM MOVE
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="relative flex-1 w-full h-full min-h-[380px] cursor-grab active:cursor-grabbing bg-[#f6f6f9]" />

      {/* Real-time Telemetry Overlay Bar */}
      <div className="px-4 py-2.5 bg-white border-t border-neutral-100 flex flex-wrap items-center justify-between text-[11px] font-sans text-neutral-600 gap-y-1">
        <div className="flex items-center space-x-2">
          <span className="text-neutral-400 font-medium">PHASE:</span>
          <span className="text-neutral-950 font-bold uppercase tracking-wide">
            {currentStepLabel}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-neutral-400 font-medium">JOINTS θ₁-θ₆:</span>
          <span className="text-neutral-950 font-mono font-bold">
            [{jointTelemetry.map((j) => `${j}°`).join(', ')}]
          </span>
          <span className="text-neutral-400 font-medium">GRIPPER:</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              gripperTelemetry ? 'bg-[#ccff00] text-neutral-950' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {gripperTelemetry ? 'CLAMPED' : 'OPEN'}
          </span>
        </div>
      </div>
    </div>
  );
}
