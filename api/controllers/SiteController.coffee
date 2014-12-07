module.exports =
  index: (req, res) ->
    console.log "awa", req.user
    if req.user isnt undefined
      res.view 'homepage'
    else
      res.redirect '/login'
    # res.view 'homepage'