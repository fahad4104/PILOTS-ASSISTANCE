"use client";

import { useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

// ============== AIRCRAFT CONFIGURATIONS ==============

type AircraftConfig = {
  name: string;
  speeds: number[];
  pressAlts: number[];
  weights: number[];
  oats: number[];
  meltThreshold: number;
  cautionThreshold: number;
  maxAlt: number;
  data: Record<number, Record<number, number[]>>;
};

// B777 Configuration
const B777_CONFIG: AircraftConfig = {
  name: "Boeing 777",
  speeds: [80, 100, 120, 140, 160, 180],
  pressAlts: [0, 4000, 8000],
  weights: [180, 200, 220, 240, 260, 280, 300, 320, 340, 360],
  oats: [10, 15, 20, 25, 30, 35, 40, 45, 50],
  meltThreshold: 45,
  cautionThreshold: 36,
  maxAlt: 8000,
  data: {
    360: {
      10: [22.7, 24.8, 27.2, 33.9, 37.4, 41.5, 47.5, 52.9, 59.1, 61.2, 63.3, 69.7, 78.1, 87.6, 98.4, 94.4, 105, 118.4],
      20: [23.6, 25.7, 28.2, 35.1, 38.8, 43.0, 49.3, 54.9, 61.2, 64.5, 72.1, 80.9, 80.8, 90.6, 101.7, 97.6, 109.2, 122.5],
      30: [24.6, 26.9, 29.5, 36.8, 40.5, 45.2, 51.8, 57.7, 64.5, 68.1, 76.2, 85.5, 85.7, 95.8, 107.3, 102.6, 114.9, 128.4],
      40: [25.6, 28.0, 30.8, 38.6, 42.4, 47.4, 54.3, 60.6, 67.9, 71.9, 80.4, 90.3, 90.7, 101.3, 113.2, 107.9, 120.8, 134.7],
      50: [26.7, 29.2, 32.1, 40.4, 44.3, 49.6, 56.9, 63.5, 71.4, 75.8, 84.8, 95.2, 95.9, 107.0, 119.5, 113.5, 127.0, 141.4],
    },
    320: {
      10: [20.8, 22.6, 24.8, 30.8, 33.9, 37.6, 43.1, 47.8, 53.3, 56.3, 62.9, 70.4, 79.1, 89.0, 99.8, 87.5, 97.5, 109.5],
      20: [21.7, 23.5, 25.7, 32.0, 35.4, 39.2, 44.9, 49.9, 55.7, 58.9, 65.9, 73.9, 73.1, 81.9, 91.9, 89.5, 99.9, 111.1],
      30: [22.4, 24.1, 26.3, 32.7, 36.1, 39.9, 45.8, 50.9, 56.7, 59.9, 66.9, 74.9, 74.9, 83.9, 94.9, 92.7, 103.7, 116.3],
      40: [23.5, 25.4, 27.8, 34.7, 38.1, 42.1, 48.4, 53.9, 60.1, 63.6, 71.1, 79.8, 79.9, 89.4, 100.1, 98.4, 110.3, 123.9],
      50: [24.6, 26.6, 29.2, 36.5, 40.1, 44.4, 51.1, 57.0, 63.8, 67.5, 75.7, 85.0, 85.1, 95.1, 106.5, 104.6, 117.4, 131.9],
    },
    280: {
      10: [18.8, 20.4, 22.3, 27.6, 30.4, 33.7, 38.5, 42.8, 47.7, 50.2, 56.2, 63.0, 62.9, 70.6, 79.4, 75.9, 85.4, 96.2],
      20: [19.5, 21.2, 23.2, 28.7, 31.7, 35.1, 40.1, 44.6, 49.7, 52.5, 58.7, 65.9, 65.6, 73.6, 82.7, 79.2, 89.0, 100.1],
      30: [20.0, 21.7, 22.6, 28.1, 30.9, 34.2, 39.1, 43.5, 48.4, 51.1, 57.2, 64.2, 63.9, 71.7, 80.6, 77.1, 86.7, 97.6],
      40: [21.0, 22.8, 25.0, 31.0, 34.2, 37.9, 43.4, 48.3, 53.9, 57.0, 63.8, 71.7, 71.3, 80.0, 90.0, 86.1, 96.8, 109.0],
      50: [21.9, 23.7, 26.0, 32.3, 35.7, 39.5, 45.3, 50.5, 56.4, 59.6, 66.8, 75.1, 74.7, 83.8, 94.3, 90.2, 101.4, 114.2],
    },
    240: {
      10: [16.1, 17.4, 18.9, 23.2, 25.4, 27.9, 31.8, 35.0, 38.8, 40.9, 45.3, 50.5, 50.8, 56.6, 63.4, 61.6, 68.6, 77.0],
      20: [16.7, 18.0, 19.6, 24.1, 26.3, 28.9, 32.9, 36.3, 40.2, 42.3, 47.0, 52.3, 52.6, 58.6, 65.6, 63.5, 70.9, 79.5],
      30: [17.4, 18.8, 20.4, 25.2, 27.5, 30.2, 34.5, 38.1, 42.2, 44.5, 49.5, 55.1, 55.4, 61.8, 69.2, 67.0, 74.9, 84.1],
      40: [18.1, 19.6, 21.3, 26.3, 28.8, 31.6, 36.2, 39.9, 44.4, 46.9, 52.1, 58.2, 58.5, 65.2, 73.1, 70.8, 79.2, 88.9],
      50: [18.9, 20.4, 22.3, 27.5, 30.1, 33.0, 37.9, 41.9, 46.6, 49.2, 54.9, 61.2, 61.6, 68.7, 77.0, 74.5, 83.5, 93.7],
    },
    200: {
      10: [14.3, 15.4, 16.6, 20.2, 22.0, 24.1, 27.2, 29.9, 32.9, 34.5, 38.1, 42.4, 42.4, 47.1, 52.5, 50.8, 56.7, 63.4],
      20: [14.8, 15.9, 17.2, 21.0, 22.8, 24.9, 28.2, 30.9, 34.2, 35.8, 39.5, 44.0, 44.0, 48.9, 54.5, 52.7, 58.7, 65.7],
      30: [15.4, 16.6, 18.0, 21.9, 23.8, 26.1, 29.5, 32.4, 35.8, 37.5, 41.4, 46.2, 46.2, 51.4, 57.3, 55.5, 61.9, 69.3],
      40: [16.0, 17.3, 18.7, 22.9, 24.9, 27.3, 30.9, 33.9, 37.5, 39.4, 43.5, 48.5, 48.6, 54.1, 60.4, 58.5, 65.2, 73.1],
      50: [16.7, 18.0, 19.5, 23.9, 26.0, 28.5, 32.4, 35.6, 39.4, 41.4, 45.8, 51.1, 51.2, 57.0, 63.6, 61.6, 68.8, 77.2],
    },
  },
};

// B787 Configuration
const B787_CONFIG: AircraftConfig = {
  name: "Boeing 787",
  speeds: [100, 120, 140, 160, 180, 200],
  pressAlts: [0, 5000, 10000],
  weights: [120, 140, 160, 180, 200, 220, 240, 260],
  oats: [0, 10, 20, 25, 30, 35, 40],
  meltThreshold: 57,
  cautionThreshold: 41,
  maxAlt: 10000,
  data: {
    260: {
      0: [35.0, 40.3, 46.5, 48.4, 56.1, 65.2, 63.4, 73.6, 86.3, 79.6, 93.1, 109.0, 96.7, 113.0, 114.2],
      10: [36.2, 41.6, 48.1, 50.0, 58.0, 67.4, 65.6, 76.1, 89.3, 82.4, 96.3, 112.7, 100.0, 117.0, 118.1],
      20: [37.4, 43.1, 49.6, 51.6, 59.9, 69.5, 67.7, 78.7, 92.2, 85.1, 99.5, 116.5, 103.3, 120.6, 125.4],
      30: [38.5, 44.3, 51.2, 53.2, 61.8, 71.7, 69.9, 81.2, 95.2, 87.9, 102.6, 120.2, 106.6, 124.4, 129.0],
      40: [39.1, 45.0, 54.2, 62.4, 67.2, 77.0, 87.7, 71.5, 82.8, 97.9, 90.0, 105.9, 125.8, 108.9, 128.5],
    },
    240: {
      0: [32.7, 37.6, 43.3, 44.8, 52.0, 60.2, 58.4, 67.9, 79.4, 73.3, 85.6, 100.4, 89.0, 103.9, 121.5],
      10: [33.8, 38.8, 44.8, 46.4, 53.9, 62.3, 60.5, 70.3, 82.2, 75.9, 88.6, 103.8, 92.1, 107.4, 125.7],
      20: [34.9, 40.1, 46.3, 48.0, 55.7, 64.5, 62.6, 72.7, 85.0, 78.5, 91.6, 107.3, 95.2, 111.0, 130.0],
      30: [35.9, 41.4, 47.8, 49.5, 57.5, 66.6, 64.6, 75.1, 87.8, 81.0, 94.6, 110.8, 98.3, 114.7, 134.3],
      40: [36.5, 42.0, 51.0, 58.4, 62.5, 71.5, 81.1, 66.0, 76.6, 90.1, 82.8, 97.2, 115.8, 100.4, 118.2],
    },
    220: {
      0: [30.4, 34.9, 40.1, 41.3, 47.9, 55.2, 53.5, 62.2, 72.5, 67.0, 78.2, 91.5, 81.2, 94.7, 110.7],
      10: [31.4, 36.1, 41.5, 42.8, 49.7, 57.2, 55.4, 64.4, 75.1, 69.3, 80.9, 94.7, 84.0, 98.0, 114.6],
      20: [32.4, 37.2, 42.8, 44.2, 51.3, 59.1, 57.3, 66.5, 77.6, 71.7, 83.6, 97.8, 86.8, 101.2, 118.5],
      30: [33.4, 38.4, 44.2, 45.6, 53.0, 61.1, 59.2, 68.7, 80.2, 74.0, 86.3, 101.0, 89.6, 104.5, 122.3],
      40: [33.9, 39.0, 47.8, 54.5, 57.8, 66.0, 74.7, 60.5, 70.2, 82.2, 75.7, 88.5, 105.5, 91.6, 107.5],
    },
    200: {
      0: [25.8, 29.5, 33.5, 40.5, 46.7, 45.0, 52.3, 60.8, 56.0, 65.4, 76.3, 67.6, 78.9, 92.1, 79.3, 95.1],
      10: [27.1, 31.0, 35.5, 36.9, 42.5, 48.9, 47.5, 55.1, 64.0, 59.1, 68.9, 80.3, 71.2, 83.1, 97.0],
      20: [27.5, 31.5, 36.1, 37.5, 43.2, 49.9, 48.5, 56.2, 65.5, 60.5, 70.5, 82.4, 73.1, 85.3, 99.7],
      30: [28.4, 32.5, 37.3, 38.8, 44.6, 51.5, 50.1, 58.1, 67.8, 62.5, 72.9, 85.2, 75.6, 88.2, 103.1],
      40: [28.8, 33.0, 37.8, 39.4, 45.3, 52.3, 50.9, 59.1, 68.9, 63.5, 74.0, 86.5, 76.8, 89.7, 104.8],
    },
    180: {
      0: [23.5, 26.8, 30.5, 31.8, 36.3, 41.6, 40.6, 47.0, 54.5, 50.2, 58.5, 68.1, 60.3, 70.4, 82.0],
      10: [24.3, 27.7, 31.6, 32.9, 37.6, 43.2, 42.1, 48.8, 56.7, 52.1, 60.8, 70.8, 62.7, 73.2, 85.3],
      20: [25.0, 28.6, 32.6, 34.0, 38.9, 44.7, 43.6, 50.5, 58.8, 54.0, 63.0, 73.4, 65.0, 75.9, 88.5],
      30: [25.9, 29.5, 33.7, 35.1, 40.2, 46.2, 45.0, 52.2, 60.8, 55.9, 65.2, 75.9, 67.3, 78.5, 91.6],
      40: [26.3, 30.0, 34.2, 35.7, 40.9, 47.0, 45.8, 53.1, 61.8, 56.8, 66.3, 77.2, 68.4, 79.9, 93.1],
    },
    160: {
      0: [20.9, 23.7, 27.0, 27.7, 31.6, 36.3, 35.2, 40.8, 47.4, 43.5, 50.8, 59.2, 52.2, 61.0, 71.2],
      10: [21.6, 24.6, 28.0, 28.8, 32.9, 37.8, 36.6, 42.5, 49.4, 45.3, 52.9, 61.7, 54.4, 63.6, 74.2],
      20: [22.3, 25.4, 29.0, 29.8, 34.1, 39.2, 38.0, 44.1, 51.3, 47.0, 54.9, 64.1, 56.6, 66.1, 77.1],
      30: [23.0, 26.2, 30.0, 30.8, 35.3, 40.6, 39.4, 45.7, 53.2, 48.7, 56.9, 66.4, 58.7, 68.6, 80.0],
      40: [23.4, 26.7, 30.5, 31.4, 35.9, 41.3, 40.1, 46.5, 54.2, 49.6, 57.9, 67.6, 59.8, 69.8, 81.5],
    },
    140: {
      0: [18.9, 21.5, 24.6, 25.2, 28.7, 33.0, 32.0, 37.4, 43.2, 39.4, 45.4, 52.6, 47.3, 54.8, 63.7],
      10: [19.6, 22.3, 25.4, 26.0, 29.7, 34.3, 33.1, 38.4, 44.7, 40.4, 47.0, 54.8, 48.9, 57.1, 66.5],
      20: [20.2, 23.0, 26.2, 26.9, 30.7, 35.4, 34.3, 39.8, 46.3, 42.2, 49.2, 57.4, 50.5, 59.3, 69.3],
      30: [20.9, 23.7, 27.0, 27.8, 31.8, 36.6, 35.5, 41.2, 48.0, 43.6, 50.9, 59.4, 52.5, 61.4, 71.6],
      40: [21.2, 24.2, 27.5, 28.3, 32.3, 37.3, 36.1, 41.9, 48.8, 44.4, 51.9, 60.5, 53.5, 62.5, 73.0],
    },
    120: {
      0: [18.9, 21.5, 24.6, 25.2, 28.7, 33.0, 32.0, 37.4, 43.2, 39.4, 45.4, 52.6, 47.3, 54.8, 63.7],
      10: [19.6, 22.3, 25.4, 26.0, 29.7, 34.3, 33.1, 38.4, 44.7, 40.4, 47.0, 54.8, 48.9, 57.1, 66.5],
      20: [19.9, 22.6, 25.8, 26.5, 30.2, 34.9, 33.7, 39.1, 45.5, 41.3, 48.1, 56.1, 49.7, 58.1, 67.8],
      30: [20.2, 23.0, 26.2, 26.8, 30.7, 35.4, 34.2, 39.7, 46.2, 42.0, 48.9, 57.0, 50.5, 59.0, 68.9],
      40: [20.9, 23.7, 27.0, 27.7, 31.6, 36.5, 35.4, 41.0, 47.9, 43.4, 50.6, 59.1, 52.3, 61.1, 71.4],
    },
  },
};

// ============== CALCULATION FUNCTIONS ==============

function interpolate(x: number, x1: number, x2: number, y1: number, y2: number): number {
  if (x1 === x2) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

function findClosestValues(arr: number[], target: number): [number, number] {
  if (target <= arr[0]) return [arr[0], arr[0]];
  if (target >= arr[arr.length - 1]) return [arr[arr.length - 1], arr[arr.length - 1]];

  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] <= target && arr[i + 1] >= target) {
      return [arr[i], arr[i + 1]];
    }
  }
  return [arr[0], arr[arr.length - 1]];
}

function getEnergyAtSpeedIndex(
  config: AircraftConfig,
  weight: number,
  oat: number,
  altIndex: number,
  speedIndex: number
): number | null {
  const [wLower, wUpper] = findClosestValues(config.weights, weight);
  const [oLower, oUpper] = findClosestValues(config.oats, oat);

  const dataIndex = speedIndex * 3 + altIndex;

  const wLowerData = config.data[wLower];
  const wUpperData = config.data[wUpper];

  if (!wLowerData || !wUpperData) return null;

  const oLowerLower = wLowerData[oLower]?.[dataIndex];
  const oUpperLower = wLowerData[oUpper]?.[dataIndex];
  const oLowerUpper = wUpperData[oLower]?.[dataIndex];
  const oUpperUpper = wUpperData[oUpper]?.[dataIndex];

  if (oLowerLower === undefined || oUpperLower === undefined ||
      oLowerUpper === undefined || oUpperUpper === undefined) return null;

  const energyLowerWeight = interpolate(oat, oLower, oUpper, oLowerLower, oUpperLower);
  const energyUpperWeight = interpolate(oat, oLower, oUpper, oLowerUpper, oUpperUpper);

  return interpolate(weight, wLower, wUpper, energyLowerWeight, energyUpperWeight);
}

function getBrakeEnergy(
  config: AircraftConfig,
  weight: number,
  oat: number,
  pressAlt: number,
  speedIndex: number
): number | null {
  const alts = config.pressAlts;
  let altLower = alts[0];
  let altUpper = alts[0];
  let altIndexLower = 0;
  let altIndexUpper = 0;

  for (let i = 0; i < alts.length - 1; i++) {
    if (pressAlt >= alts[i] && pressAlt <= alts[i + 1]) {
      altLower = alts[i];
      altUpper = alts[i + 1];
      altIndexLower = i;
      altIndexUpper = i + 1;
      break;
    }
  }

  if (pressAlt >= alts[alts.length - 1]) {
    altLower = alts[alts.length - 1];
    altUpper = alts[alts.length - 1];
    altIndexLower = alts.length - 1;
    altIndexUpper = alts.length - 1;
  }

  const energyLower = getEnergyAtSpeedIndex(config, weight, oat, altIndexLower, speedIndex);
  const energyUpper = getEnergyAtSpeedIndex(config, weight, oat, altIndexUpper, speedIndex);

  if (energyLower === null || energyUpper === null) return null;

  return interpolate(pressAlt, altLower, altUpper, energyLower, energyUpper);
}

function findMeltZoneSpeed(
  config: AircraftConfig,
  weight: number,
  oat: number,
  pressAlt: number
): { speed: number; energy: number; zone: string } {
  const energies: { speed: number; energy: number }[] = [];

  for (let i = 0; i < config.speeds.length; i++) {
    const energy = getBrakeEnergy(config, weight, oat, pressAlt, i);
    if (energy !== null) {
      energies.push({ speed: config.speeds[i], energy });
    }
  }

  if (energies.length === 0) {
    return { speed: 0, energy: 0, zone: "ERROR" };
  }

  if (energies[0].energy >= config.meltThreshold) {
    return { speed: config.speeds[0], energy: energies[0].energy, zone: "FUSE PLUG MELT ZONE" };
  }

  const lastEnergy = energies[energies.length - 1];
  const maxSpeed = config.speeds[config.speeds.length - 1];

  if (lastEnergy.energy < config.meltThreshold) {
    return { speed: 0, energy: lastEnergy.energy, zone: `Above ${maxSpeed} KIAS` };
  }

  for (let i = 0; i < energies.length - 1; i++) {
    const current = energies[i];
    const next = energies[i + 1];

    if (current.energy < config.meltThreshold && next.energy >= config.meltThreshold) {
      const meltZoneSpeed = interpolate(
        config.meltThreshold,
        current.energy,
        next.energy,
        current.speed,
        next.speed
      );

      const roundedSpeed = Math.round(meltZoneSpeed);
      return { speed: roundedSpeed, energy: config.meltThreshold, zone: "FUSE PLUG MELT ZONE" };
    }
  }

  return { speed: lastEnergy.speed, energy: lastEnergy.energy, zone: "NORMAL" };
}

// ============== COMPONENT ==============

export default function BrakeCoolingPage() {
  const [aircraft, setAircraft] = useState<"777" | "787">("777");
  const [weight, setWeight] = useState<string>("");
  const [oat, setOat] = useState<string>("30");
  const [pressAlt, setPressAlt] = useState<string>("0");
  const [result, setResult] = useState<{ speed: number; energy: number; zone: string } | null>(null);

  const config = aircraft === "777" ? B777_CONFIG : B787_CONFIG;

  const handleAircraftChange = (newAircraft: "777" | "787") => {
    setAircraft(newAircraft);
    setWeight("");
    setResult(null);
  };

  const calculate = () => {
    const w = parseInt(weight);
    const o = parseInt(oat);
    const p = parseInt(pressAlt);

    if (isNaN(w) || isNaN(o) || isNaN(p)) {
      alert("Please enter valid numbers");
      return;
    }

    const minWeight = config.weights[0];
    const maxWeight = config.weights[config.weights.length - 1];
    if (w < minWeight || w > maxWeight) {
      alert(`Weight must be between ${minWeight} and ${maxWeight} (x1000 kg)`);
      return;
    }

    const minOat = config.oats[0];
    const maxOat = config.oats[config.oats.length - 1];
    if (o < minOat || o > maxOat) {
      alert(`OAT must be between ${minOat}°C and ${maxOat}°C`);
      return;
    }

    if (p < 0 || p > config.maxAlt) {
      alert(`Pressure Altitude must be between 0 and ${config.maxAlt.toLocaleString()} ft`);
      return;
    }

    const res = findMeltZoneSpeed(config, w, o, p);
    setResult(res);
  };

  const maxSpeed = config.speeds[config.speeds.length - 1];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <Link
              href="/applications"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 mb-4"
            >
              ← Back to Applications
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Brake Cooling Calculator</h1>
            <p className="mt-2 text-gray-600">
              RTO Speed That Causes Fuse Plug Melt Zone
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              {/* Aircraft Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Aircraft Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAircraftChange("777")}
                    className={`py-3 px-4 rounded-xl font-semibold text-lg transition-all ${
                      aircraft === "777"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Boeing 777
                  </button>
                  <button
                    onClick={() => handleAircraftChange("787")}
                    className={`py-3 px-4 rounded-xl font-semibold text-lg transition-all ${
                      aircraft === "787"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Boeing 787
                  </button>
                </div>
              </div>

              {/* Weight Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Weight (x1000 kg)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
                  placeholder={`${config.weights[0]} - ${config.weights[config.weights.length - 1]}`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Range: {config.weights[0]} - {config.weights[config.weights.length - 1]}
                </p>
              </div>

              {/* OAT Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  OAT (°C)
                </label>
                <input
                  type="number"
                  value={oat}
                  onChange={(e) => setOat(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
                  placeholder="30"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Range: {config.oats[0]} - {config.oats[config.oats.length - 1]}°C
                </p>
              </div>

              {/* Pressure Altitude Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pressure Altitude (ft)
                </label>
                <input
                  type="number"
                  value={pressAlt}
                  onChange={(e) => setPressAlt(e.target.value)}
                  min="0"
                  max={config.maxAlt}
                  step="100"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Range: 0 - {config.maxAlt.toLocaleString()} ft
                </p>
              </div>

              {/* Calculate Button */}
              <button
                onClick={calculate}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 rounded-xl shadow-md hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transition-all"
              >
                Calculate Melt Zone Speed
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="rounded-xl p-6 bg-red-50 border-2 border-red-300">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600 mb-1">Fuse Plug Melt Zone Speed</p>
                    <p className="text-5xl font-bold text-red-700">
                      {result.speed === 0 ? `>${maxSpeed} KIAS` : `${result.speed} KIAS`}
                    </p>

                    <p className="mt-2 text-sm text-gray-500">
                      Melt Zone Threshold: {config.meltThreshold} million ft-lb
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-red-200 text-red-800">
                      ⚠️ FUSE PLUG MELT ZONE
                    </div>

                    <p className="mt-4 text-sm text-red-700">
                      {result.speed === 0
                        ? `Melt zone speed exceeds ${maxSpeed} KIAS for these conditions.`
                        : `RTO at ${result.speed} KIAS or above will cause fuse plug melt.`}
                    </p>

                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> If V1 exceeds this speed, consider delaying takeoff to allow brakes to cool.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center text-xs text-gray-500">
                  <p>Reference: {config.name} FCOM - Advisory Information</p>
                  <p>For actual operations, always refer to current aircraft documentation</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
