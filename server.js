const express = require('express');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Rank hierarchy for proper sorting (includes divisions)
function getRankValue(rank) {
  const rankHierarchy = {
    'Iron': 1,
    'Bronze': 2,
    'Silver': 3,
    'Gold': 4,
    'Platinum': 5,
    'Emerald': 6,
    'Diamond': 7,
    'Master': 8,
    'Grandmaster': 9,
    'Challenger': 10
  };
  
  const divisionValues = {
    'IV': 0.25,
    'III': 0.5,
    'II': 0.75,
    'I': 1.0
  };
  
  // Parse rank and division
  const rankParts = rank.split(' ');
  const rankName = rankParts[0];
  const division = rankParts[1];
  
  const baseRankValue = rankHierarchy[rankName] || 0;
  
  // For Master and above, no divisions
  if (baseRankValue >= 8) {
    return baseRankValue;
  }
  
  // For ranks below Master, add division value
  const divisionValue = divisionValues[division] || 0;
  return baseRankValue + divisionValue;
}

// Scraping function
async function scrapeTFTData(username, region = 'na') {
  try {
    const url = `https://lolchess.gg/profile/${region}/${username}/set16`;
    console.log(`Scraping URL: ${url}`);
    
    const response = await fetch(url);
    const $ = cheerio.load(await response.text());
    
    // Extract user and region
    const nameText = $('.name').text();
    const userMatch = nameText.match(/^([^#]+#[^N]+)/);
    const user = userMatch ? userMatch[1] : nameText.split('NA')[0];
    
    // Extract profile avatar
    const avatarImg = $('.avatar img');
    const avatarSrc = avatarImg.attr('src') || '';
    
    // Extract rank image
    const rankImg = $('.rank img');
    const rankImageSrc = rankImg.attr('src') || '';
    
    // Extract rank and LP - Updated to handle high LP values properly
    const tierText = $('.tier').text();
    console.log(`Raw tier text for ${username}: "${tierText}"`);
    
    // Look for rank with division (e.g., "Diamond II", "Gold III")
    const rankWithDivisionMatch = tierText.match(/^([A-Za-z]+)\s+(I{1,3}V?|IV)/);
    // Look for rank without division (Master, Grandmaster, Challenger)
    const rankWithoutDivisionMatch = tierText.match(/^(Master|Grandmaster|Challenger)/);
    
    let rank = '';
    if (rankWithDivisionMatch) {
      rank = `${rankWithDivisionMatch[1]} ${rankWithDivisionMatch[2]}`;
    } else if (rankWithoutDivisionMatch) {
      rank = rankWithoutDivisionMatch[1];
    } else {
      // Fallback to original logic
      const rankMatch = tierText.match(/^([A-Za-z]+)/);
      rank = rankMatch ? rankMatch[1] : '';
    }
    
    // Enhanced LP extraction - handle comma-separated numbers and ensure we get the full value
    const lpMatches = [
      tierText.match(/(\d{1,3}(?:,\d{3})*)\s*LP/), // Handle comma-separated numbers like "1,026 LP"
      tierText.match(/(\d+)\s*LP/), // Fallback for regular numbers
      tierText.match(/LP\s*(\d{1,3}(?:,\d{3})*)/), // Alternative pattern
      tierText.match(/LP\s*(\d+)/) // Alternative fallback
    ];
    
    let LP = 0;
    for (const match of lpMatches) {
      if (match) {
        // Remove commas and parse as integer
        LP = parseInt(match[1].replace(/,/g, ''));
        console.log(`LP extracted for ${username}: ${LP} (from "${match[1]}")`);
        break;
      }
    }
    
    if (LP === 0) {
      console.warn(`Could not extract LP for ${username}. Tier text: "${tierText}"`);
    }
    
    // Extract stats from labels
    const labelsText = $('.labels').text();
    console.log(`Raw labels text for ${username}: "${labelsText}"`);
    
    const winsMatch = labelsText.match(/승리(\d+)/);
    const wins = winsMatch ? parseInt(winsMatch[1]) : 0;
    
    const winRateMatch = labelsText.match(/승률([\d.]+)%/);
    const winRate = winRateMatch ? parseFloat(winRateMatch[1]) : 0;
    
    const top4Match = labelsText.match(/Top4(\d+)/);
    const top4Count = top4Match ? parseInt(top4Match[1]) : 0;
    
    const top4RateMatch = labelsText.match(/Top4\s*비율([\d.]+)%/);
    const top4Rate = top4RateMatch ? parseFloat(top4RateMatch[1]) : 0;
    
    const gamesMatch = labelsText.match(/게임\s*수(\d+)/);
    const games = gamesMatch ? parseInt(gamesMatch[1]) : 0;
    
    const avgRankMatch = labelsText.match(/평균\s*등수#([\d.]+)/);
    const avgRank = avgRankMatch ? parseFloat(avgRankMatch[1]) : 0;
    
    const result = {
      user,
      region: region.toUpperCase(),
      avatar: avatarSrc,
      rankImage: rankImageSrc,
      rank,
      LP,
      wins,
      winRate,
      top4Count,
      top4Rate,
      games,
      avgRank,
      profileUrl: url // Add the profile URL for linking
    };
    
    console.log(`Final data for ${username}:`, JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error(`Error scraping data for ${username}:`, error);
    return null;
  }
}

// API endpoint to get leaderboard data (original)
app.get('/api/leaderboard', async (req, res) => {
  console.log('Fetching leaderboard data...');
  
  const players = [
    { username: 'bird-biird', region: 'na' },
    { username: 'Monoceros-atlas', region: 'na' },
    { username: 'babyyccee-ttv', region: 'na' },
    { username: 'ashwu-0321', region: 'na' }
  ];
  
  const leaderboardData = [];
  
  for (const player of players) {
    console.log(`Scraping data for ${player.username}...`);
    const data = await scrapeTFTData(player.username, player.region);
    if (data) {
      leaderboardData.push(data);
    }
  }
  
  if (leaderboardData.length > 0) {
    // Sort by rank first (descending), then by LP (descending) for proper leaderboard ranking
    leaderboardData.sort((a, b) => {
      const rankDiff = getRankValue(b.rank) - getRankValue(a.rank);
      if (rankDiff !== 0) {
        return rankDiff; // Sort by rank first
      }
      return b.LP - a.LP; // If same rank, sort by LP
    });
    
    console.log('Final leaderboard data:', JSON.stringify(leaderboardData, null, 2));
    res.json(leaderboardData);
  } else {
    res.status(500).json({ error: 'Failed to fetch any player data' });
  }
});

// API endpoint to get leaderboard2 data (new)
app.get('/api/leaderboard2', async (req, res) => {
  console.log('Fetching leaderboard 2 data...');
  
  const players = [
    { username: 'noa6-6367', region: 'na' },
    { username: 'naruto-g3r', region: 'na' },
    { username: 'uoo-3009', region: 'na' },
    { username: 'noafknhandsome-kim', region: 'na' },
    { username: 'testosteronepump-999', region: 'na' },
    { username: 'albertkanggg-NA1', region: 'na' },
    { username: 'sieun-ieu', region: 'na' },
    { username: '993-tty', region: 'na' },
    { username: 'ziroh-4444', region: 'na' }
  ];
  
  const leaderboardData = [];
  
  for (const player of players) {
    console.log(`Scraping data for ${player.username}...`);
    const data = await scrapeTFTData(player.username, player.region);
    if (data) {
      leaderboardData.push(data);
    }
  }
  
  if (leaderboardData.length > 0) {
    // Sort by rank first (descending), then by LP (descending) for proper leaderboard ranking
    leaderboardData.sort((a, b) => {
      const rankDiff = getRankValue(b.rank) - getRankValue(a.rank);
      if (rankDiff !== 0) {
        return rankDiff; // Sort by rank first
      }
      return b.LP - a.LP; // If same rank, sort by LP
    });
    
    console.log('Final leaderboard 2 data:', JSON.stringify(leaderboardData, null, 2));
    res.json(leaderboardData);
  } else {
    res.status(500).json({ error: 'Failed to fetch any player data' });
  }
});

// Serve the HTML page (original)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the second leaderboard HTML page
app.get('/leaderboard2', (req, res) => {
  res.sendFile(path.join(__dirname, 'leaderboard2.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Leaderboard 1 will show data for: bird-biird, Monoceros-atlas, babyyccee-ttv, ashwu-0321');
  console.log('Leaderboard 2 will show data for: noa6#6367, naruto#g3r, uoo#3009, noafknhandsome#kim, testosteronepump#999, albertkanggg#NA1, sieun#ieu, 993#tty, ziroh#4444');
});