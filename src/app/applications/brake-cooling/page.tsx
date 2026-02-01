"use client";

import { useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

// Brake energy data from 777 FCOM tables
// Structure: brakeEnergyData[weight][oat][pressAlt][speed] = energy (millions of foot pounds)
// Speeds: 80, 100, 120, 140, 160, 180 KIAS
// Pressure Altitudes: 0, 4000, 8000 ft
// Weights: 180-360 (x1000 kg)
// OAT: 10-50°C

const SPEEDS = [80, 100, 120, 140, 160, 180];
const PRESS_ALTS = [0, 4000, 8000];
const WEIGHTS = [180, 200, 220, 240, 260, 280, 300, 320, 340, 360];
const OATS = [10, 15, 20, 25, 30, 35, 40, 45, 50];

// Sample data from the table (simplified - key weight/OAT combinations)
// Format: [speed80_alt0, speed80_alt4, speed80_alt8, speed100_alt0, ...]
const brakeEnergyTable: Record<number, Record<number, number[]>> = {
  360: {
    10: [22.7, 24.8, 27.2, 33.9, 37.4, 41.5, 47.5, 52.9, 59.1, 61.2, 63.3, 69.7, 78.1, 87.6, 98.4, 94.4, 105, 118.4],
    15: [23.2, 25.3, 27.8, 34.5, 38.1, 42.3, 48.4, 53.9, 60.2, 63.4, 70.9, 79.6, 79.5, 89.1, 100.1, 96.0, 107.5, 120.3],
    20: [23.6, 25.7, 28.2, 35.1, 38.8, 43.0, 49.3, 54.9, 61.2, 64.5, 72.1, 80.9, 80.8, 90.6, 101.7, 97.6, 109.2, 122.5],
    25: [24.1, 26.3, 28.9, 36.0, 39.6, 44.1, 50.5, 56.3, 62.9, 66.3, 74.1, 83.2, 83.2, 93.1, 104.4, 100.0, 112.1, 125.4],
    30: [24.6, 26.9, 29.5, 36.8, 40.5, 45.2, 51.8, 57.7, 64.5, 68.1, 76.2, 85.5, 85.7, 95.8, 107.3, 102.6, 114.9, 128.4],
    35: [25.1, 27.4, 30.2, 37.7, 41.4, 46.3, 53.0, 59.1, 66.2, 70.0, 78.3, 87.9, 88.2, 98.5, 110.2, 105.2, 117.8, 131.5],
    40: [25.6, 28.0, 30.8, 38.6, 42.4, 47.4, 54.3, 60.6, 67.9, 71.9, 80.4, 90.3, 90.7, 101.3, 113.2, 107.9, 120.8, 134.7],
    45: [26.2, 28.6, 31.5, 39.5, 43.3, 48.5, 55.6, 62.0, 69.6, 73.8, 82.6, 92.7, 93.3, 104.1, 116.3, 110.7, 123.9, 138.0],
    50: [26.7, 29.2, 32.1, 40.4, 44.3, 49.6, 56.9, 63.5, 71.4, 75.8, 84.8, 95.2, 95.9, 107.0, 119.5, 113.5, 127.0, 141.4],
  },
  340: {
    10: [21.7, 23.5, 26.0, 32.4, 35.7, 39.5, 45.3, 50.4, 57.3, 57.5, 65.4, 74.5, 76.3, 86.4, 97.0, 91.6, 102.6, 115.0],
    15: [22.1, 24.1, 26.5, 33.0, 36.5, 40.3, 46.1, 51.3, 57.3, 60.4, 67.5, 75.7, 77.0, 86.3, 96.8, 93.1, 104.1, 116.6],
    20: [22.6, 24.6, 27.0, 33.6, 37.2, 41.2, 47.0, 52.3, 58.5, 61.5, 68.8, 77.1, 78.5, 87.9, 98.5, 94.6, 106.0, 118.8],
    25: [23.0, 25.1, 27.6, 34.4, 37.9, 42.0, 48.2, 53.6, 59.8, 63.1, 70.5, 79.1, 79.1, 88.7, 99.5, 95.5, 107.1, 119.9],
    30: [23.5, 25.7, 28.3, 35.3, 38.8, 43.1, 49.4, 55.0, 61.5, 65.0, 72.5, 81.5, 81.7, 91.5, 102.5, 98.4, 110.3, 123.5],
    35: [24.0, 26.2, 28.9, 36.1, 39.7, 44.1, 50.6, 56.4, 63.1, 66.9, 74.6, 83.9, 84.4, 94.3, 105.6, 101.4, 113.6, 127.2],
    40: [24.6, 26.8, 29.5, 37.0, 40.6, 45.2, 51.9, 57.8, 64.8, 68.8, 76.8, 86.4, 87.1, 97.2, 108.8, 104.4, 116.9, 131.0],
    45: [25.1, 27.4, 30.2, 37.9, 41.6, 46.3, 53.2, 59.3, 66.5, 70.8, 79.0, 88.9, 89.9, 100.2, 112.1, 107.5, 120.4, 134.9],
    50: [25.6, 28.0, 30.8, 38.8, 42.6, 47.5, 54.5, 60.8, 68.3, 72.8, 81.3, 91.5, 92.7, 103.3, 115.5, 110.6, 123.9, 138.9],
  },
  320: {
    10: [20.8, 22.6, 24.8, 30.8, 33.9, 37.6, 43.1, 47.8, 53.3, 56.3, 62.9, 70.4, 79.1, 89.0, 99.8, 87.5, 97.5, 109.5],
    15: [21.2, 23.0, 25.2, 31.4, 34.6, 38.3, 43.8, 48.7, 54.3, 57.4, 64.2, 71.9, 71.9, 81.1, 91.9, 89.9, 100.6, 113.1],
    20: [21.7, 23.5, 25.7, 32.0, 35.4, 39.2, 44.9, 49.9, 55.7, 58.9, 65.9, 73.9, 73.1, 81.9, 91.9, 89.5, 99.9, 111.1],
    25: [22.1, 24.1, 26.3, 32.7, 36.1, 39.9, 45.8, 50.9, 56.7, 59.9, 66.9, 74.9, 75.1, 84.4, 94.4, 90.9, 101.4, 114.0],
    30: [22.4, 24.1, 26.3, 32.7, 36.1, 39.9, 45.8, 50.9, 56.7, 59.9, 66.9, 74.9, 74.9, 83.9, 94.9, 92.7, 103.7, 116.3],
    35: [23.0, 24.9, 27.2, 33.9, 37.2, 41.1, 47.2, 52.5, 58.5, 61.9, 69.1, 77.5, 77.5, 86.8, 97.2, 95.6, 107.1, 120.2],
    40: [23.5, 25.4, 27.8, 34.7, 38.1, 42.1, 48.4, 53.9, 60.1, 63.6, 71.1, 79.8, 79.9, 89.4, 100.1, 98.4, 110.3, 123.9],
    45: [24.1, 26.0, 28.5, 35.6, 39.1, 43.3, 49.8, 55.5, 61.9, 65.5, 73.4, 82.4, 82.5, 92.2, 103.3, 101.5, 113.8, 127.9],
    50: [24.6, 26.6, 29.2, 36.5, 40.1, 44.4, 51.1, 57.0, 63.8, 67.5, 75.7, 85.0, 85.1, 95.1, 106.5, 104.6, 117.4, 131.9],
  },
  300: {
    10: [19.8, 21.5, 23.5, 29.2, 32.2, 35.6, 40.8, 45.3, 50.4, 53.2, 59.4, 66.5, 66.8, 74.8, 84.0, 80.9, 90.7, 101.5],
    15: [20.2, 21.9, 24.0, 29.8, 32.8, 36.3, 41.6, 46.1, 51.4, 54.2, 60.5, 67.7, 68.0, 76.1, 85.4, 82.3, 92.3, 103.5],
    20: [20.5, 22.3, 24.4, 30.4, 33.4, 36.9, 42.3, 46.9, 52.3, 55.1, 61.5, 68.9, 69.1, 77.4, 86.9, 83.7, 93.8, 105.5],
    25: [21.0, 22.8, 25.0, 31.1, 34.2, 37.8, 43.4, 48.1, 53.6, 56.6, 63.2, 70.8, 70.9, 79.5, 89.3, 86.1, 96.4, 108.1],
    30: [21.2, 22.9, 25.1, 31.4, 34.6, 38.3, 43.8, 48.7, 54.3, 57.4, 64.2, 71.9, 71.0, 79.5, 89.5, 86.1, 96.4, 108.1],
    35: [21.7, 23.4, 25.7, 32.2, 35.4, 39.2, 45.0, 50.0, 55.8, 59.0, 66.0, 74.0, 73.5, 82.3, 92.4, 88.9, 99.7, 111.9],
    40: [22.1, 22.9, 25.1, 31.1, 34.3, 34.6, 38.3, 48.4, 54.5, 54.5, 56.6, 63.2, 70.8, 80.6, 80.6, 91.0, 91.0, 102.1],
    45: [22.6, 24.4, 26.8, 33.6, 36.8, 40.8, 46.9, 52.1, 58.2, 61.6, 68.9, 77.3, 77.1, 86.4, 97.0, 93.9, 105.3, 118.3],
    50: [22.8, 24.7, 27.4, 34.9, 35.3, 38.3, 44.0, 48.8, 54.8, 58.8, 54.8, 57.9, 64.8, 72.8, 72.8, 81.8, 79.8, 89.6],
  },
  280: {
    10: [18.8, 20.4, 22.3, 27.6, 30.4, 33.7, 38.5, 42.8, 47.7, 50.2, 56.2, 63.0, 62.9, 70.6, 79.4, 75.9, 85.4, 96.2],
    15: [19.2, 20.8, 22.7, 28.1, 31.0, 34.3, 39.2, 43.6, 48.5, 51.2, 57.3, 64.2, 64.1, 71.9, 80.8, 77.3, 87.0, 97.9],
    20: [19.5, 21.2, 23.2, 28.7, 31.7, 35.1, 40.1, 44.6, 49.7, 52.5, 58.7, 65.9, 65.6, 73.6, 82.7, 79.2, 89.0, 100.1],
    25: [20.0, 21.7, 23.8, 29.4, 32.5, 36.0, 41.1, 45.7, 51.0, 53.9, 60.3, 67.7, 67.3, 75.5, 84.9, 81.2, 91.3, 102.8],
    30: [20.0, 21.7, 22.6, 28.1, 30.9, 34.2, 39.1, 43.5, 48.4, 51.1, 57.2, 64.2, 63.9, 71.7, 80.6, 77.1, 86.7, 97.6],
    35: [20.6, 22.4, 24.5, 30.3, 33.5, 37.1, 42.4, 47.2, 52.7, 55.7, 62.4, 70.1, 69.7, 78.2, 87.9, 84.1, 94.6, 106.5],
    40: [21.0, 22.8, 25.0, 31.0, 34.2, 37.9, 43.4, 48.3, 53.9, 57.0, 63.8, 71.7, 71.3, 80.0, 90.0, 86.1, 96.8, 109.0],
    45: [21.4, 23.2, 25.5, 31.6, 34.9, 38.7, 44.3, 49.3, 55.0, 58.2, 65.2, 73.3, 72.9, 81.8, 92.0, 88.0, 99.0, 111.5],
    50: [21.9, 23.7, 26.0, 32.3, 35.7, 39.5, 45.3, 50.5, 56.4, 59.6, 66.8, 75.1, 74.7, 83.8, 94.3, 90.2, 101.4, 114.2],
  },
  260: {
    10: [17.9, 19.4, 21.2, 26.2, 28.8, 31.7, 36.3, 40.1, 44.6, 47.1, 52.4, 58.5, 58.9, 65.9, 73.8, 71.4, 80.0, 89.5],
    15: [18.2, 19.8, 21.6, 26.7, 29.3, 32.3, 37.0, 40.9, 45.4, 48.0, 53.4, 59.6, 60.0, 67.1, 75.0, 72.6, 81.4, 91.1],
    20: [18.6, 20.1, 21.9, 27.2, 29.8, 32.9, 37.6, 41.6, 46.2, 48.8, 54.3, 60.6, 61.1, 68.3, 76.3, 73.9, 82.7, 92.5],
    25: [19.0, 20.6, 22.4, 27.9, 30.5, 33.7, 38.6, 42.7, 47.4, 50.1, 55.7, 62.3, 62.7, 70.1, 78.3, 75.9, 85.0, 95.1],
    30: [19.0, 20.7, 22.6, 28.1, 28.1, 28.1, 36.2, 40.2, 44.8, 47.4, 52.7, 58.9, 59.3, 66.4, 74.3, 71.9, 80.5, 90.2],
    35: [19.5, 21.2, 23.2, 28.8, 31.5, 34.8, 39.9, 44.2, 49.2, 52.0, 58.0, 64.9, 65.3, 73.1, 81.8, 79.2, 88.8, 99.5],
    40: [19.9, 21.6, 23.6, 29.4, 32.2, 35.5, 40.7, 45.2, 50.3, 53.2, 59.4, 66.4, 66.8, 74.8, 83.7, 81.0, 90.8, 101.8],
    45: [20.4, 22.1, 24.2, 30.0, 32.9, 36.4, 41.7, 46.3, 51.6, 54.6, 60.9, 68.2, 68.5, 76.7, 85.9, 83.1, 93.2, 104.5],
    50: [20.8, 22.5, 24.6, 30.6, 33.6, 37.2, 42.6, 47.4, 52.9, 55.9, 62.5, 70.0, 70.3, 78.7, 88.2, 85.3, 95.6, 107.2],
  },
  240: {
    10: [16.1, 17.4, 18.9, 23.2, 25.4, 27.9, 31.8, 35.0, 38.8, 40.9, 45.3, 50.5, 50.8, 56.6, 63.4, 61.6, 68.6, 77.0],
    15: [16.4, 17.7, 19.2, 23.7, 25.8, 28.4, 32.4, 35.6, 39.5, 41.6, 46.2, 51.4, 51.7, 57.6, 64.5, 62.4, 69.8, 78.3],
    20: [16.7, 18.0, 19.6, 24.1, 26.3, 28.9, 32.9, 36.3, 40.2, 42.3, 47.0, 52.3, 52.6, 58.6, 65.6, 63.5, 70.9, 79.5],
    25: [17.0, 18.4, 20.0, 24.6, 26.9, 29.6, 33.7, 37.2, 41.2, 43.4, 48.2, 53.7, 54.0, 60.2, 67.4, 65.2, 72.9, 81.8],
    30: [17.4, 18.8, 20.4, 25.2, 27.5, 30.2, 34.5, 38.1, 42.2, 44.5, 49.5, 55.1, 55.4, 61.8, 69.2, 67.0, 74.9, 84.1],
    35: [17.8, 19.2, 20.9, 25.8, 28.2, 30.9, 35.4, 39.1, 43.4, 45.8, 50.9, 56.8, 57.0, 63.6, 71.3, 69.0, 77.2, 86.7],
    40: [18.1, 19.6, 21.3, 26.3, 28.8, 31.6, 36.2, 39.9, 44.4, 46.9, 52.1, 58.2, 58.5, 65.2, 73.1, 70.8, 79.2, 88.9],
    45: [18.5, 20.0, 21.8, 26.9, 29.4, 32.3, 37.0, 40.9, 45.5, 48.1, 53.5, 59.7, 60.0, 66.9, 75.0, 72.6, 81.3, 91.2],
    50: [18.9, 20.4, 22.3, 27.5, 30.1, 33.0, 37.9, 41.9, 46.6, 49.2, 54.9, 61.2, 61.6, 68.7, 77.0, 74.5, 83.5, 93.7],
  },
  220: {
    10: [15.1, 16.4, 17.8, 21.7, 23.7, 26.0, 29.5, 32.4, 35.9, 37.8, 41.9, 46.7, 46.9, 52.1, 58.3, 56.5, 63.0, 70.5],
    15: [15.4, 16.7, 18.1, 22.1, 24.1, 26.5, 30.0, 33.0, 36.5, 38.5, 42.7, 47.5, 47.8, 53.1, 59.3, 57.4, 64.0, 71.7],
    20: [15.6, 17.0, 18.4, 22.5, 24.5, 26.9, 30.6, 33.6, 37.2, 39.1, 43.4, 48.4, 48.6, 54.1, 60.4, 58.4, 65.2, 73.0],
    25: [15.9, 17.3, 18.8, 23.0, 25.0, 27.4, 31.2, 34.3, 38.0, 40.0, 44.4, 49.5, 49.7, 55.4, 61.8, 59.8, 66.8, 74.8],
    30: [16.3, 17.6, 19.2, 23.5, 25.6, 28.1, 31.9, 35.1, 38.9, 41.0, 45.5, 50.7, 50.9, 56.7, 63.4, 61.4, 68.6, 76.9],
    35: [16.6, 18.0, 19.6, 24.0, 26.2, 28.7, 32.7, 35.9, 39.8, 42.0, 46.6, 52.0, 52.2, 58.2, 65.1, 63.1, 70.4, 79.0],
    40: [17.0, 18.4, 20.0, 24.6, 26.8, 29.4, 33.5, 36.8, 40.8, 43.1, 47.8, 53.4, 53.6, 59.8, 66.9, 64.8, 72.4, 81.2],
    45: [17.3, 18.7, 20.4, 25.1, 27.4, 30.1, 34.3, 37.7, 41.8, 44.1, 49.0, 54.7, 55.0, 61.3, 68.6, 66.5, 74.3, 83.4],
    50: [17.7, 19.1, 20.9, 25.7, 28.0, 30.8, 35.1, 38.6, 42.9, 45.3, 50.3, 56.2, 56.4, 62.9, 70.5, 68.3, 76.3, 85.7],
  },
  200: {
    10: [14.3, 15.4, 16.6, 20.2, 22.0, 24.1, 27.2, 29.9, 32.9, 34.5, 38.1, 42.4, 42.4, 47.1, 52.5, 50.8, 56.7, 63.4],
    15: [14.5, 15.7, 16.9, 20.6, 22.4, 24.5, 27.7, 30.4, 33.6, 35.2, 38.8, 43.2, 43.2, 48.0, 53.5, 51.8, 57.7, 64.5],
    20: [14.8, 15.9, 17.2, 21.0, 22.8, 24.9, 28.2, 30.9, 34.2, 35.8, 39.5, 44.0, 44.0, 48.9, 54.5, 52.7, 58.7, 65.7],
    25: [15.1, 16.3, 17.6, 21.5, 23.3, 25.5, 28.9, 31.7, 35.0, 36.7, 40.5, 45.1, 45.1, 50.1, 55.9, 54.1, 60.3, 67.5],
    30: [15.4, 16.6, 18.0, 21.9, 23.8, 26.1, 29.5, 32.4, 35.8, 37.5, 41.4, 46.2, 46.2, 51.4, 57.3, 55.5, 61.9, 69.3],
    35: [15.7, 17.0, 18.4, 22.4, 24.4, 26.7, 30.2, 33.2, 36.7, 38.5, 42.5, 47.4, 47.4, 52.8, 58.9, 57.0, 63.6, 71.2],
    40: [16.0, 17.3, 18.7, 22.9, 24.9, 27.3, 30.9, 33.9, 37.5, 39.4, 43.5, 48.5, 48.6, 54.1, 60.4, 58.5, 65.2, 73.1],
    45: [16.4, 17.7, 19.1, 23.4, 25.5, 27.9, 31.7, 34.8, 38.5, 40.4, 44.6, 49.8, 49.9, 55.5, 62.0, 60.0, 67.0, 75.1],
    50: [16.7, 18.0, 19.5, 23.9, 26.0, 28.5, 32.4, 35.6, 39.4, 41.4, 45.8, 51.1, 51.2, 57.0, 63.6, 61.6, 68.8, 77.2],
  },
  180: {
    10: [13.4, 14.3, 15.4, 18.5, 20.0, 21.8, 24.5, 26.8, 29.4, 30.8, 33.9, 37.6, 37.6, 41.7, 46.3, 44.7, 49.7, 55.5],
    15: [13.6, 14.6, 15.7, 18.9, 20.4, 22.2, 25.0, 27.3, 30.0, 31.4, 34.6, 38.4, 38.4, 42.6, 47.3, 45.7, 50.8, 56.7],
    20: [13.8, 14.9, 16.0, 19.3, 20.8, 22.6, 25.4, 27.8, 30.5, 32.0, 35.3, 39.1, 39.2, 43.4, 48.3, 46.6, 51.8, 57.9],
    25: [14.1, 15.2, 16.3, 19.7, 21.3, 23.1, 26.0, 28.4, 31.2, 32.7, 36.1, 40.0, 40.1, 44.5, 49.5, 47.8, 53.2, 59.4],
    30: [14.4, 15.5, 16.7, 20.1, 21.8, 23.7, 26.6, 29.1, 31.9, 33.5, 37.0, 41.0, 41.1, 45.6, 50.8, 49.1, 54.6, 61.0],
    35: [14.6, 15.8, 17.0, 20.6, 22.2, 24.2, 27.2, 29.8, 32.7, 34.3, 37.9, 42.0, 42.1, 46.8, 52.1, 50.4, 56.1, 62.7],
    40: [14.9, 16.1, 17.4, 21.0, 22.8, 24.8, 27.9, 30.5, 33.5, 35.2, 38.9, 43.1, 43.2, 48.0, 53.5, 51.7, 57.6, 64.4],
    45: [15.2, 16.4, 17.7, 21.5, 23.3, 25.3, 28.5, 31.2, 34.4, 36.1, 39.9, 44.3, 44.3, 49.3, 54.9, 53.1, 59.2, 66.2],
    50: [15.5, 16.7, 18.1, 22.0, 23.8, 25.9, 29.2, 32.0, 35.2, 37.0, 40.9, 45.4, 45.5, 50.6, 56.4, 54.5, 60.8, 68.0],
  },
};

// FUSE PLUG MELT threshold (millions of foot pounds)
const MELT_ZONE_THRESHOLD = 45;
const CAUTION_ZONE_THRESHOLD = 36;

function interpolate(x: number, x1: number, x2: number, y1: number, y2: number): number {
  if (x1 === x2) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

function findClosestValues(arr: number[], target: number): [number, number] {
  // Handle out of range
  if (target <= arr[0]) return [arr[0], arr[0]];
  if (target >= arr[arr.length - 1]) return [arr[arr.length - 1], arr[arr.length - 1]];

  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] <= target && arr[i + 1] >= target) {
      return [arr[i], arr[i + 1]];
    }
  }

  return [arr[0], arr[arr.length - 1]];
}

function getEnergyAtSpeedIndex(weight: number, oat: number, altIndex: number, speedIndex: number): number | null {
  const [wLower, wUpper] = findClosestValues(WEIGHTS, weight);
  const [oLower, oUpper] = findClosestValues(OATS, oat);

  const dataIndex = speedIndex * 3 + altIndex;

  const wLowerData = brakeEnergyTable[wLower];
  const wUpperData = brakeEnergyTable[wUpper];

  if (!wLowerData || !wUpperData) return null;

  const oLowerLower = wLowerData[oLower]?.[dataIndex];
  const oUpperLower = wLowerData[oUpper]?.[dataIndex];
  const oLowerUpper = wUpperData[oLower]?.[dataIndex];
  const oUpperUpper = wUpperData[oUpper]?.[dataIndex];

  if (oLowerLower === undefined || oUpperLower === undefined ||
      oLowerUpper === undefined || oUpperUpper === undefined) return null;

  // Interpolate OAT for lower weight
  const energyLowerWeight = interpolate(oat, oLower, oUpper, oLowerLower, oUpperLower);

  // Interpolate OAT for upper weight
  const energyUpperWeight = interpolate(oat, oLower, oUpper, oLowerUpper, oUpperUpper);

  // Interpolate weight
  return interpolate(weight, wLower, wUpper, energyLowerWeight, energyUpperWeight);
}

function getBrakeEnergy(weight: number, oat: number, pressAlt: number, speedIndex: number): number | null {
  // Interpolate pressure altitude (0, 4000, 8000)
  let altLower = 0;
  let altUpper = 0;
  let altIndexLower = 0;
  let altIndexUpper = 0;

  if (pressAlt <= 0) {
    altLower = 0; altUpper = 0;
    altIndexLower = 0; altIndexUpper = 0;
  } else if (pressAlt >= 8000) {
    altLower = 8000; altUpper = 8000;
    altIndexLower = 2; altIndexUpper = 2;
  } else if (pressAlt <= 4000) {
    altLower = 0; altUpper = 4000;
    altIndexLower = 0; altIndexUpper = 1;
  } else {
    altLower = 4000; altUpper = 8000;
    altIndexLower = 1; altIndexUpper = 2;
  }

  const energyLower = getEnergyAtSpeedIndex(weight, oat, altIndexLower, speedIndex);
  const energyUpper = getEnergyAtSpeedIndex(weight, oat, altIndexUpper, speedIndex);

  if (energyLower === null || energyUpper === null) return null;

  return interpolate(pressAlt, altLower, altUpper, energyLower, energyUpper);
}

function findMeltZoneSpeed(weight: number, oat: number, pressAlt: number): { speed: number; energy: number; zone: string } {
  // Get energy at each speed point
  const energies: { speed: number; energy: number }[] = [];

  for (let i = 0; i < SPEEDS.length; i++) {
    const energy = getBrakeEnergy(weight, oat, pressAlt, i);
    if (energy !== null) {
      energies.push({ speed: SPEEDS[i], energy });
    }
  }

  if (energies.length === 0) {
    return { speed: 0, energy: 0, zone: "ERROR" };
  }

  // If even lowest speed (80 KIAS) is already in melt zone
  if (energies[0].energy >= MELT_ZONE_THRESHOLD) {
    return { speed: 80, energy: energies[0].energy, zone: "FUSE PLUG MELT ZONE" };
  }

  // If highest speed (180 KIAS) is still below melt zone
  const lastEnergy = energies[energies.length - 1];
  if (lastEnergy.energy < MELT_ZONE_THRESHOLD) {
    return { speed: 0, energy: lastEnergy.energy, zone: "Above 180 KIAS" };
  }

  // Find where energy crosses the threshold and interpolate to find exact melt zone speed
  for (let i = 0; i < energies.length - 1; i++) {
    const current = energies[i];
    const next = energies[i + 1];

    if (current.energy < MELT_ZONE_THRESHOLD && next.energy >= MELT_ZONE_THRESHOLD) {
      // Interpolate to find exact speed where energy = 45 (melt zone threshold)
      const meltZoneSpeed = interpolate(
        MELT_ZONE_THRESHOLD,
        current.energy,
        next.energy,
        current.speed,
        next.speed
      );

      // Round to nearest integer
      const roundedSpeed = Math.round(meltZoneSpeed);

      return { speed: roundedSpeed, energy: MELT_ZONE_THRESHOLD, zone: "FUSE PLUG MELT ZONE" };
    }
  }

  // Fallback
  return { speed: energies[energies.length - 1].speed, energy: energies[energies.length - 1].energy, zone: "NORMAL" };
}

export default function BrakeCoolingPage() {
  const [weight, setWeight] = useState<string>("280");
  const [oat, setOat] = useState<string>("30");
  const [pressAlt, setPressAlt] = useState<string>("0");
  const [result, setResult] = useState<{ speed: number; energy: number; zone: string } | null>(null);

  const calculate = () => {
    const w = parseInt(weight);
    const o = parseInt(oat);
    const p = parseInt(pressAlt);

    if (isNaN(w) || isNaN(o) || isNaN(p)) {
      alert("Please enter valid numbers");
      return;
    }

    if (w < 180 || w > 360) {
      alert("Weight must be between 180 and 360 (x1000 kg)");
      return;
    }

    if (o < 10 || o > 50) {
      alert("OAT must be between 10°C and 50°C");
      return;
    }

    if (p < 0 || p > 8000) {
      alert("Pressure Altitude must be between 0 and 8,000 ft");
      return;
    }

    const res = findMeltZoneSpeed(w, o, p);
    setResult(res);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <main className="mx-auto max-w-2xl px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/applications"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 mb-4"
            >
              ← Back to Applications
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Brake Cooling Calculator</h1>
            <p className="mt-2 text-gray-600">
              Boeing 777 - RTO Speed That Causes Fuse Plug Melt Zone
            </p>
          </div>

          {/* Calculator Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              {/* Weight Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Weight (x1000 kg)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  min="180"
                  max="360"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
                  placeholder="280"
                />
                <p className="mt-1 text-xs text-gray-500">Range: 180 - 360</p>
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
                  min="10"
                  max="50"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
                  placeholder="30"
                />
                <p className="mt-1 text-xs text-gray-500">Range: 10 - 50°C</p>
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
                  max="8000"
                  step="100"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500">Range: 0 - 8,000 ft</p>
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
                      {result.speed === 0 ? ">180 KIAS" : `${result.speed} KIAS`}
                    </p>

                    <p className="mt-2 text-sm text-gray-500">
                      Brake Energy at this speed: {result.energy.toFixed(1)} million ft-lb
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-red-200 text-red-800">
                      ⚠️ FUSE PLUG MELT ZONE
                    </div>

                    <p className="mt-4 text-sm text-red-700">
                      {result.speed === 0
                        ? "Melt zone speed exceeds 180 KIAS for these conditions."
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
                  <p>Reference: 777 FCOM - Advisory Information</p>
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
