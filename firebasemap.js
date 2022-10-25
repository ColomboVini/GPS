var data = {
    sender: null,
    timestamp: null,
    lat: null,
    lng: null
};//Dados do objeto a serem gravados no DB. 

function makeInfoBox(controlDiv, map) {
    var controlUI = document.createElement('div');
    controlUI.style.boxShadow = 'rgba(0, 0, 0, 0.298039) 0px 1px 4px -1px';
    controlUI.style.backgroundColor = '#fff';
    controlUI.style.border = '2px solid #fff';
    controlUI.style.borderRadius = '2px';
    controlUI.style.marginBottom = '22px';
    controlUI.style.marginTop = '10px';
    controlUI.style.textAlign = 'center';
    controlDiv.appendChild(controlUI);

    var controlText = document.createElement('div');
    controlText.style.color = 'rgb(25,25,25)';
    controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
    controlText.style.fontSize = '100%';
    controlText.style.padding = '6px';
    controlText.innerText = 'As informacoes mostradas no mapa serao apagadas em 10 minutos.';
    controlUI.appendChild(controlText);
}

/*
* Parte onde ocorre a autenticacao o usuario.
* @param {function()} onAuthSuccess - Chamado quando a autenticação é bem-sucedida.
*/
function initAuthentication(onAuthSuccess) {
    firebase.auth().signInAnonymously().catch(function (error) {
        console.log(error.code + ", " + error.message);
    }, { remember: 'sessionOnly' });

    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            data.sender = user.uid;
            onAuthSuccess();
        } else {
            // User is signed out.
        }
    });
}

function initMap() {
    var map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -21.79856389860187, lng: -46.56017151958151 },
        zoom: 15,
        styles: [{
            featureType: 'poi',
            stylers: [{ visibility: 'off' }]  // Desabilitar pontos de interesse.
        }, {
            featureType: 'transit.station',
            stylers: [{ visibility: 'off' }]  // Desabilitar pontos no mapa.
        }],
        disableDoubleClickZoom: true,
        streetViewControl: false
    });

    var infoBoxDiv = document.createElement('div');
    var infoBox = new makeInfoBox(infoBoxDiv, map);
    infoBoxDiv.index = 1;
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(infoBoxDiv);

    // Coleta as informações do click do mouse, e armazena no Firebase.
    map.addListener('click', function (e) {
        data.lat = e.latLng.lat();
        data.lng = e.latLng.lng();
        addToFirebase(data);
    });

    // Cria os ponto no mapa.
    var heatmap = new google.maps.visualization.HeatmapLayer({
        data: [],
        map: map,
        radius: 16
    });

    initAuthentication(initFirebase.bind(undefined, heatmap));
}



// Coleta as informações do click e o adiciona no mapa.
clicks.orderByChild('timestamp').startAt(startTime).on('child_added',
    function (snapshot) {
        var newPosition = snapshot.val();
        var point = new google.maps.LatLng(newPosition.lat, newPosition.lng);
        heatmap.getData().push(point);
    }
);

function initFirebase(heatmap) {
    
    //Excluira ponto no mapa com mais de 10 minutos.
    var startTime = new Date().getTime() - (60 * 10 * 1000);

    // Referencias dos cliques do mouse no Firebase.
    var clicks = firebase.database().ref('clicks');

    // Coleta as infomações do clique, e o adiciona ao mapa.
    clicks.orderByChild('timestamp').startAt(startTime).on('child_added',
        function (snapshot) {
            var newPosition = snapshot.val();
            var point = new google.maps.LatLng(newPosition.lat, newPosition.lng);
            var elapsedMs = Date.now() - newPosition.timestamp;

            // Adiciona o ponto ao mapa.
            heatmap.getData().push(point);

            var expiryMs = Math.max(60 * 10 * 1000 - elapsed, 0);
            window.setTimeout(function () {
                snapshot.ref.remove();
            }, expiryMs);
        }
    );

    // Remover dados antigos com mais de 10 minutos do Firebase.
    clicks.on('child_removed', function (snapshot, prevChildKey) {
        var heatmapData = heatmap.getData();
        var i = 0;
        while (snapshot.val().lat != heatmapData.getAt(i).lat()
            || snapshot.val().lng != heatmapData.getAt(i).lng()) {
            i++;
        }
        heatmapData.removeAt(i);
    });
}

/*
       * Atualiza o caminho last_message/ com o timestamp atual.
       * @param {function(Date)} addClick Após a atualização do timestamp da última mensagem,
       * esta função é chamada com o timestamp atual para adicionar o
       * clique ao mapa. 
       */
 function getTimestamp(addClick) {
    var ref = firebase.database().ref('last_message/' + data.sender);

    ref.onDisconnect().remove(); 

    ref.set(firebase.database.ServerValue.TIMESTAMP, function(err) {
      if (err) {  
        console.log(err);
      } else {  
        ref.once('value', function(snap) {
          addClick(snap.val()); 
        }, function(err) {
          console.warn(err);
        });
      }
    });
  }

  /*
       * Adiciona um clique ao Firebase.
       * @param {Object} data Os dados a serem adicionados ao firebase.
       * contém lat, lng, remetente e timestamp.
       */
   function addToFirebase(data) {
    getTimestamp(function(timestamp) {
      // Add the new timestamp to the record data.
      data.timestamp = timestamp;
      var ref = firebase.database().ref('clicks').push(data, function(err) {
        if (err) {  // Data was not written to firebase.
          console.warn(err);
        }
      });
    });
  }