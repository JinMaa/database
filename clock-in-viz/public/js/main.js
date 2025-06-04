document.addEventListener('DOMContentLoaded', function() {
  // Fetch clock-in data
  fetch('/api/clock-in-data')
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        renderVisualization(result.data);
        populateTable(result.data.records);
      } else {
        showError(result.error || 'An error occurred while fetching data');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('Failed to fetch data. Please try again later.');
    });
  
  function renderVisualization(data) {
    const { blockData, globalMaxClockIn } = data;
    
    // Hide loading indicator and show visualization container
    document.getElementById('loading').style.display = 'none';
    document.getElementById('visualization-container').style.display = 'block';
    
    // Clear previous visualization
    const container = d3.select('#block-visualization');
    container.html('');
    
    // Set up SVG dimensions
    const margin = { top: 50, right: 40, bottom: 80, left: 60 };
    const width = Math.max(blockData.length * 100, 800) - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create X scale for block heights
    const x = d3.scaleBand()
      .domain(blockData.map(d => d.height))
      .range([0, width])
      .padding(0.2);
    
    // Create Y scale for clock-in count
    const y = d3.scaleLinear()
      .domain([0, globalMaxClockIn * 1.1]) // Add 10% for visualization margin
      .range([height, 0]);
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');
    
    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(y));
    
    // Add X axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .text('Block Height');
    
    // Add Y axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .text('Max Clock-In Count');
    
    // Add title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('Block Clock-In Visualization');
    
    // Create bars for each block
    svg.selectAll('.bar')
      .data(blockData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.height))
      .attr('y', d => y(d.maxClockIn))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.maxClockIn))
      .attr('fill', '#0d6efd')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('fill', '#0a58ca');
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        tooltip.html(`
          <strong>Block Height:</strong> ${d.height}<br>
          <strong>Max Clock-In Count:</strong> ${d.maxClockIn}<br>
          <strong>Transactions:</strong> ${d.transactions.length}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill', '#0d6efd');
        tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });
    
    // Add value labels above bars
    svg.selectAll('.label')
      .data(blockData)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('x', d => x(d.height) + x.bandwidth() / 2)
      .attr('y', d => y(d.maxClockIn) - 5)
      .text(d => d.maxClockIn);
    
    // Create horizontal blocks visualization
    const blockContainer = container.append('div')
      .attr('class', 'block-container')
      .style('margin-top', '40px');
    
    blockData.forEach(block => {
      const blockDiv = blockContainer.append('div')
        .attr('class', 'block')
        .attr('data-block-height', block.height);
      
      blockDiv.append('div')
        .attr('class', 'block-header')
        .text(`Block ${block.height}`);
      
      const blockContent = blockDiv.append('div')
        .attr('class', 'block-content');
      
      const barContainer = blockContent.append('div')
        .attr('class', 'clock-in-bar');
      
      barContainer.append('div')
        .attr('class', 'clock-in-fill')
        .style('width', `${(block.maxClockIn / globalMaxClockIn) * 100}%`);
      
      blockContent.append('div')
        .text(`Max: ${block.maxClockIn}`);
      
      blockDiv.append('div')
        .attr('class', 'block-footer')
        .text(`${block.transactions.length} tx`);
    });
  }
  
  function populateTable(records) {
    const tableBody = document.querySelector('#data-table tbody');
    tableBody.innerHTML = '';
    
    records.forEach(record => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${record.blockHeight}</td>
        <td>${record.txid}</td>
        <td>${record.address || 'N/A'}</td>
        <td>${record.clockInCount}</td>
        <td>${record.blockMaxClockIn}</td>
        <td>${record.globalMaxClockIn}</td>
      `;
      
      tableBody.appendChild(row);
    });
  }
  
  function showError(message) {
    document.getElementById('loading').style.display = 'none';
    
    const container = document.getElementById('visualization-container');
    container.style.display = 'block';
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <h4 class="alert-heading">Error</h4>
        <p>${message}</p>
      </div>
    `;
  }
});
