// ==UserScript==
// @name            Steam 2018 summer game hacker
// @description     _(:3」∠)_
// @author          MapleRecall
// @namespace       https://coding.net/u/maplerecall
// @downloadURL     https://coding.net/u/maplerecall/p/steam-2018-summer-game-hack/git/raw/master/index.user.js
//
// @license         MIT License
// @copyright       Copyright (C) 2018, by MapleRecall 
//
// @include         https://steamcommunity.com/saliengame
// @include         https://steamcommunity.com/saliengame/
// @include         https://steamcommunity.com/saliengame/play
// @include         https://steamcommunity.com/saliengame/play/
//
// @version         1.2.1
// @updateURL       https://coding.net/u/maplerecall/p/steam-2018-summer-game-hack/git/raw/master/index.user.js
//
// @run-at          document-start|document-end
// @grant           none
// ==/UserScript==

'use strict';

(async function ($, forSTCN) {
    const gameUrlPrefix = 'https://community.steam-api.com/ITerritoryControlMinigameService'
    const stcnId = 255962
    let token
    let gameTimer
    let errorTime = 0
    let score
    let currentGame
    let running = false
    let $output = $('#dogeOutput')
    let currentZone
    let fireTarget
	// SG, braid 波斯王子, osmos
    let specialPlanets = ['视觉小说星', '时间操控星', '放松星二号', ];

    if ($output.length === 0) {
        let $dogeBody = $('<div>').css({
            boxSizing: 'border-box', position: 'fixed', bottom: 0, left: '20px', right: '20px', zIndex: 999999,
            padding: '10px', borderRadius: '5px 5px 0 0', background: '#171a21', color: '#b8b6b4',
            boxShadow: '0 0 20px #000'
        }).appendTo($('body'))
        $output = $('<div id="dogeOutput">').css({ height: '200px', overflow: 'auto', margin: '0 0 10px' }).appendTo($dogeBody)
        $(`<div class="global_header_toggle_button">`).text('　START　').click(() => { window.superDoge.start() }).appendTo($dogeBody)
        $(`<div class="global_header_toggle_button">`).text('　STOP　').click(() => { window.superDoge.stop() }).appendTo($dogeBody)
    }

    async function joinGame() {
        clearTimeout(gameTimer)
        log(`==============================================================`)
        errorTime = 0
        try {
            log(`Fetch info...`)
            var { response } = await $.post(`${gameUrlPrefix}/GetPlayerInfo/v0001/`, `access_token=${token}`)
            const { active_planet, level, score: _score, next_level_score, active_zone_game, clan_info } = response
            // console.log(response)
            if (active_zone_game) {
                log('Alreay in a game, try to leave...')
                await $.post(`https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/`, `access_token=${token}&gameid=${active_zone_game}`)
            }
            if (forSTCN && (!clan_info || clan_info.accountid !== stcnId)) {
                await $.post(`${gameUrlPrefix}/RepresentClan/v0001/`, `clanid=103582791429777370&access_token=${token}`)
            }

            let planet
            if(active_planet) {
            	log('Leaving planet and choose new one');
            	currentGame = active_planet;
            	await stop();
            	running = true;
            }
            // joining planet
            log(`Joining planet...`)
            fireTarget = null
            var { response: { planets } } = await $.get(`${gameUrlPrefix}/GetPlanets/v0001/?active_only=1&language=schinese`)
            console.log(planets)
            planet = planets.sort((a, b) => a.state.capture_progress - b.state.capture_progress)[0]
            // check special planets
            let priority = 100;
            for(let p of planets) {
            	let idx = specialPlanets.indexOf(p.state.name);
            	if(idx >= 0 && idx < priority) {
            		priority = idx;
            		planet = p;
            	}
            }
            await $.post(`${gameUrlPrefix}/JoinPlanet/v0001/`, `id=${planet.id}&access_token=${token}`)
            

            var { response: { planets } } = await $.get(`${gameUrlPrefix}/GetPlanet/v0001/?id=${active_planet}&language=schinese`)
            planet = planets[0]
            log(`Planet: ${planet.state.name}  Level: ${level}  Exp: ${_score}/${next_level_score}  Team: ${clan_info ? clan_info.name : 'None'}`)

            let zones = planet.zones.filter(({ captured }) => !captured)
            let targetZone = zones.find(({ zone_position }) => zone_position === fireTarget)
            if (targetZone) {
                log(`>>> FIRE ZONE ${fireTarget} <<<`)
            }
            else if (forSTCN && clan_info && clan_info.accountid === stcnId) {
                targetZone = findTarget(zones, planet)
            } else {
                zones = sortZones(zones, 2)
                targetZone = zones.find(({ difficulty }) => difficulty === 3) || zones.find(({ difficulty }) => difficulty === 2) || zones[0]
            }
            currentZone = targetZone
            const { zone_position, difficulty, capture_progress: progress } = targetZone
            score = difficulty === 1 ? 600 : difficulty === 2 ? 1200 : 2400
            log(`Joining zone...`)
            var { response: { zone_info } } = await $.post(`${gameUrlPrefix}/JoinZone/v0001/`, `zone_position=${zone_position}&access_token=${token}`)
            if (zone_info) {
                log(`Join zone ${zone_position}(${zone_position % 12 + 1 | 0},${zone_position / 12 + 1 | 0}) success.`)
                log(`Progress: ${(progress * 100).toFixed(2)}%, wait 110s to send score ${score}...`)
                currentGame = zone_info.gameid
                gameTimer = setTimeout(sendScore, 110000)
            } else {
                throw 'Service reject.'
            }
        } catch (e) {
            console.error(e)
            log(`Join zone fail, wait 2.5s...`)
            gameTimer = setTimeout(joinGame, 2500)
        }
    }

    async function sendScore() {
        clearTimeout(gameTimer)
        log(`Sending score...`)
        try {
            var { response } = await $.post(`${gameUrlPrefix}/ReportScore/v0001/`, `access_token=${token}&score=${score}&language=schinese`)
            if (response['new_score']) {
                log(`Send score success, new score: ${response['new_score']}.`)
                gameTimer = setTimeout(joinGame, 100)
            } else {
                throw 'Service reject.'
            }
        } catch (e) {
            if (errorTime++ < 5) {
                console.error(e)
                log(`Send score fail ${errorTime} times, wait 2s...`)
                gameTimer = setTimeout(sendScore, 2000)
            } else {
                log(`Send score fail ${errorTime - 1} times, reset...`)
                gameTimer = setTimeout(joinGame, 100)
                errorTime = 0
            }
        }
    }

    async function start() {
        if (running) {
            return
        }
        errorTime = 0
        try {
            token = (await $.get('https://steamcommunity.com/saliengame/gettoken')).token
        } catch (e) {
            console.error(e)
            log('Get token failed, wait 2s...')
            gameTimer = setTimeout(start, 2000)
            return
        }
        running = true
        log('Script is running.')
        joinGame()
        return
    }

    async function stop() {
        clearTimeout(gameTimer)
        running = false
        log('Script is ended.')
        await $.post(`https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/`, `access_token=${token}&gameid=${currentGame}`)
    }

    function sortZones(zones, type = 0) {
        switch (type) {
            case 0: return zones.sort(({ capture_progress: a }, { capture_progress: b }) => b - a)
            case 1: return zones.sort(({ capture_progress: a }, { capture_progress: b }) => a - b)
            case 2: return zones.sort(({ zone_position: a }, { zone_position: b }) => Math.abs(48 - a) - Math.abs(48 - b))
        }
    }

    function getLeaderZone(zones, min = 1, k = 0) {
        for (let i = 0; i < min; i++) {
            let target = zones.find(({ top_clans, capture_progress }) => (capture_progress < 1 / (i * k + 1)) && top_clans[i] && top_clans[i].accountid === stcnId)
            if (target) {
                return target
            }
        }
    }

    function findTarget(_zones, planet) {
        let target
        let zonesD3 = _zones.filter(({ difficulty }) => difficulty === 3)
        let zonesD2 = _zones.filter(({ difficulty }) => difficulty === 2)
        let zonesD1 = _zones.filter(({ difficulty }) => difficulty === 1)
        if (zonesD3.length > 0) {
            target = getLeaderZone(zonesD3, 2, 2) || sortZones(zonesD3, 2)[0]
            return target
        } else if (zonesD2.length > 0) {
            target = getLeaderZone(zonesD3, 2, 2) || sortZones(zonesD2, 2)[0]
            return target
        }
        else {
            target = getLeaderZone(zonesD1, 3, 1) || sortZones(zonesD1, 2)[0]
            return target
        }
    }

    async function fire(x, y) {
        fireTarget = 12 * (y - 1) + (x - 1)
        log(`>>> SET TARGET: ZONE ${fireTarget} <<<`)
        if (fire !== currentZone.zone_position) {
            log(`Restart to change target...`)
            await stop()
            start()
        }
    }

    function endFire() {
        log(`>>> CANCLE TARGET: ZONE ${fireTarget} <<<`)
        fireTarget = null
    }

    function log() {
        const date = new Date()
        const time = `[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]\t`
        console.log(time, ...arguments)
        $output.append($('<div>').text(`${time}\t ${arguments[0]}`))
        requestAnimationFrame(() => { $output[0].scrollTop = 10e10 })
    }

    window.superDoge && window.superDoge.stop()
    window.superDoge = { start, stop, fire, endFire }
    start()
}
)(jQuery, 0)
