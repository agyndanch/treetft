/**
 * server.js - Express server that scrapes TFT data and serves HTML
 * Run: npm install express cheerio
 * Then: node server.js
 */

const express = require('express');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Rank hierarchy for proper sorting
function getRankValue(rank) {
  const rankHierarchy = {
    'Iron': 1,
    'Bronze': 2,
    'Silver': 3,
    'Gold': 4,
    'Platinum': 5,
    'Diamond': 6,
    'Emerald': 7,
    'Master': 8,
    'Grandmaster': 9,
    'Challenger': 10
  };
  
  // Extract the rank name (remove any additional text like divisions)
  const rankName = rank.split(' ')[0];
  return rankHierarchy[rankName] || 0;
}

// Scraping function
async function scrapeTFTData(username, region = 'na') {
  try {
    const url = `https://lolchess.gg/profile/${region}/${username}/set15`;
    const response = await fetch(url);
    const $ = cheerio.load(await response.text());
    
    // Extract user and region
    const nameText = $('.name').text();
    const userMatch = nameText.match(/^([^#]+#[^N]+)/);
    const user = userMatch ? userMatch[1] : nameText.split('NA')[0];
    
    // Extract profile avatar
    const avatarImg = $('.avatar img');
    const avatarSrc = avatarImg.attr('src') || '';
    
    // Extract rank and LP
    const tierText = $('.tier').text();
    const rankMatch = tierText.match(/^([A-Za-z]+)/);
    const lpMatch = tierText.match(/(\d+)\s*LP/);
    const rank = rankMatch ? rankMatch[1] : '';
    const LP = lpMatch ? parseInt(lpMatch[1]) : 0;
    
    // Extract stats from labels
    const labelsText = $('.labels').text();
    
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
    
    return {
      user,
      region: region.toUpperCase(),
      avatar: avatarSrc,
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
  } catch (error) {
    console.error('Error scraping data:', error);
    return null;
  }
}

// API endpoint to get leaderboard data
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
    
    res.json(leaderboardData);
  } else {
    res.status(500).json({ error: 'Failed to fetch any player data' });
  }
});

// Serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Leaderboard will show data for: bird-biird (NA)');
});