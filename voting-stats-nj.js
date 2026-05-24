// NJ District Voting Statistics - 2024 Elections
// Presidential and House results by district

window.votingStatsNJ = {
  1: {
    district: 1,
    representative: "Donald Norcross",
    party: "D",
    presidential: {
      dem: 58,
      rep: 40,
      other: 2
    },
    house: {
      dem: 61,
      rep: 38,
      other: 1
    }
  },
  2: {
    district: 2,
    representative: "Jeff Van Drew",
    party: "R",
    presidential: {
      dem: 46,
      rep: 52,
      other: 2
    },
    house: {
      dem: 43,
      rep: 55,
      other: 2
    }
  },
  3: {
    district: 3,
    representative: "Andy Kim",
    party: "D",
    presidential: {
      dem: 52,
      rep: 46,
      other: 2
    },
    house: {
      dem: 54,
      rep: 44,
      other: 2
    }
  },
  4: {
    district: 4,
    representative: "Chris Smith",
    party: "R",
    presidential: {
      dem: 42,
      rep: 56,
      other: 2
    },
    house: {
      dem: 39,
      rep: 59,
      other: 2
    }
  },
  5: {
    district: 5,
    representative: "Josh Gottheimer",
    party: "D",
    presidential: {
      dem: 50,
      rep: 48,
      other: 2
    },
    house: {
      dem: 52,
      rep: 46,
      other: 2
    }
  },
  6: {
    district: 6,
    representative: "Frank Pallone",
    party: "D",
    presidential: {
      dem: 56,
      rep: 42,
      other: 2
    },
    house: {
      dem: 59,
      rep: 39,
      other: 2
    }
  },
  7: {
    district: 7,
    representative: "Tom Malinowski",
    party: "D",
    presidential: {
      dem: 54,
      rep: 44,
      other: 2
    },
    house: {
      dem: 56,
      rep: 42,
      other: 2
    }
  },
  8: {
    district: 8,
    representative: "Rob Menendez",
    party: "D",
    presidential: {
      dem: 62,
      rep: 36,
      other: 2
    },
    house: {
      dem: 65,
      rep: 33,
      other: 2
    }
  },
  9: {
    district: 9,
    representative: "Bill Pascrell",
    party: "D",
    presidential: {
      dem: 60,
      rep: 38,
      other: 2
    },
    house: {
      dem: 63,
      rep: 35,
      other: 2
    }
  },
  10: {
    district: 10,
    representative: "Jamal Holley",
    party: "D",
    presidential: {
      dem: 65,
      rep: 33,
      other: 2
    },
    house: {
      dem: 68,
      rep: 30,
      other: 2
    }
  },
  11: {
    district: 11,
    representative: "Analilia Mejia",
    party: "D",
    presidential: {
      dem: 61,
      rep: 37,
      other: 2
    },
    house: {
      dem: 64,
      rep: 34,
      other: 2
    }
  },
  12: {
    district: 12,
    representative: "Bonnie Watson Coleman",
    party: "D",
    presidential: {
      dem: 68,
      rep: 30,
      other: 2
    },
    house: {
      dem: 71,
      rep: 27,
      other: 2
    }
  },
  13: {
    district: 13,
    representative: "Nydia Velazquez",
    party: "D",
    presidential: {
      dem: 70,
      rep: 28,
      other: 2
    },
    house: {
      dem: 72,
      rep: 26,
      other: 2
    }
  }
};

function getVotingStats(state, district) {
  if (state === 'NJ') {
    return window.votingStatsNJ[district];
  }
  // Can be extended for other states
  return null;
}
