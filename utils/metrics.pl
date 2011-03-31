#!/usr/bin/perl

my $z = 0;

if(scalar(@ARGV) < 1) {
	print "No zoom specified, using 0\n";
} else {
	$z = $ARGV[0];
}

open OUTFILE, ">$z.csv";

foreach my $y (0..2**$z - 1) {
	foreach my $x (0..2**$z - 1) {
		my ($west, $south, $east, $north);
		my $w = 360.0 / 2**$z;
		my $h = 170.102260 / 2**$z;
		
		$west = $x * $w - 180.0;
		$east = ($x + 1) * $w - 180.0;
		$north = (2**$z - $y) * $h - 85.051130;
		$south = (2**$z - ($y + 1)) * $h - 85.051130;
		
		my $url = sprintf(
			'http://testapi.daac.asf.alaska.edu/services/search/param?'
			. 'bbox=%.3f,%.3f,%.3f,%.3f'
			. '&format=count',
			$west, $south, $east, $north);
		my $result = `curl -s "$url"`;
		$result =~ /(\d+)/;
		print "$url: $1\n";
		print OUTFILE "$1\n";
	}
}